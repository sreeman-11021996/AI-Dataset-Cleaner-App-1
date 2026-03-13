import uuid
import pandas as pd
import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.user import Dataset as DatasetModel
from app.schemas.dataset import AnalysisResponse

router = APIRouter()


def detect_outliers_iqr(series: pd.Series) -> int:
    """Detect outliers using IQR method"""
    clean_series = series.dropna()
    if len(clean_series) == 0:
        return 0
    Q1 = clean_series.quantile(0.25)
    Q3 = clean_series.quantile(0.75)
    IQR = Q3 - Q1
    if IQR == 0:
        return 0
    lower = Q1 - 1.5 * IQR
    upper = Q3 + 1.5 * IQR
    return int(((clean_series < lower) | (clean_series > upper)).sum())


def detect_outliers_zscore(series: pd.Series, threshold: float = 3.0) -> int:
    """Detect outliers using Z-score method"""
    clean_series = series.dropna()
    if len(clean_series) == 0:
        return 0
    mean = clean_series.mean()
    std = clean_series.std()
    if std == 0:
        return 0
    z_scores = np.abs((clean_series - mean) / std)
    return int((z_scores > threshold).sum())


def detect_outliers_modified_zscore(series: pd.Series, threshold: float = 3.5) -> int:
    """Detect outliers using Modified Z-score (MAD-based)"""
    clean_series = series.dropna()
    if len(clean_series) < 4:
        return 0
    median = clean_series.median()
    mad = np.median(np.abs(clean_series - median))
    if mad == 0:
        return 0
    modified_z_scores = 0.6745 * (clean_series - median) / mad
    return int((np.abs(modified_z_scores) > threshold).sum())


def calculate_completeness_score(df: pd.DataFrame) -> float:
    """Calculate completeness score based on missing values"""
    total_cells = len(df) * len(df.columns)
    if total_cells == 0:
        return 100.0
    
    missing_cells = df.isnull().sum().sum()
    completeness_ratio = 1 - (missing_cells / total_cells)
    return round(completeness_ratio * 100, 2)


def calculate_consistency_score(df: pd.DataFrame, outliers: dict, inconsistent_categories: dict) -> float:
    """Calculate consistency score based on duplicates, outliers, and inconsistencies"""
    total_cells = len(df) * len(df.columns)
    if total_cells == 0:
        return 100.0
    
    # Duplicate rows impact
    duplicate_cells = df.duplicated().sum() * len(df.columns)
    
    # Outliers impact (cells with outliers)
    outlier_cells = sum(outliers.values())
    
    # Inconsistent categories impact
    inconsistent_cells = sum(len(v) for v in inconsistent_categories.values()) * len(df)
    
    total_issues = duplicate_cells + outlier_cells + inconsistent_cells
    consistency_ratio = 1 - (total_issues / total_cells)
    return round(max(0, consistency_ratio * 100), 2)


def calculate_imbalance_score(imbalanced_columns: dict) -> float:
    """Calculate imbalance score based on class distribution"""
    if not imbalanced_columns:
        return 100.0
    
    imbalance_penalties = []
    for col, value_counts in imbalanced_columns.items():
        if len(value_counts) < 2:
            continue
        
        values = list(value_counts.values())
        total = sum(values)
        if total == 0:
            continue
        
        # Calculate imbalance ratio (max/min ratio)
        min_count = min(values)
        max_count = max(values)
        
        if min_count == 0:
            imbalance_ratio = 1.0  # Fully imbalanced
        else:
            imbalance_ratio = min_count / max_count
        
        # Also check for significant minority class (< 10% of data)
        minority_threshold = total * 0.1
        has_significant_minority = any(v < minority_threshold for v in values)
        
        if imbalance_ratio < 0.1 or has_significant_minority:
            penalty = 50  # Severely imbalanced
        elif imbalance_ratio < 0.2:
            penalty = 30  # Highly imbalanced
        elif imbalance_ratio < 0.3:
            penalty = 15  # Moderately imbalanced
        else:
            penalty = 5  # Slightly imbalanced
        
        imbalance_penalties.append(penalty)
    
    if not imbalance_penalties:
        return 100.0
    
    avg_penalty = sum(imbalance_penalties) / len(imbalance_penalties)
    return round(max(0, 100 - avg_penalty), 2)


def calculate_overall_quality_score(
    completeness: float,
    consistency: float,
    imbalance: float
) -> float:
    """Calculate overall quality score as weighted average"""
    # Weights: Completeness 40%, Consistency 40%, Balance 20%
    overall = (completeness * 0.4) + (consistency * 0.4) + (imbalance * 0.2)
    return round(overall, 1)


def calculate_quality_score(analysis: dict, completeness: float, consistency: float, imbalance: float) -> float:
    """Legacy function - kept for compatibility"""
    return calculate_overall_quality_score(completeness, consistency, imbalance)


@router.get("/{dataset_id}/analysis", response_model=AnalysisResponse)
async def analyze_dataset(
    dataset_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(DatasetModel).filter(
        DatasetModel.id == dataset_id,
        DatasetModel.user_id == current_user.id
    ).first()
    
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    try:
        if dataset.original_filename.endswith('.csv'):
            df = pd.read_csv(dataset.file_path)
        elif dataset.original_filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(dataset.file_path)
        elif dataset.original_filename.endswith('.json'):
            df = pd.read_json(dataset.file_path)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read dataset: {str(e)}")
    
    # Detect missing values
    missing_values = {}
    missing_values_percent = {}
    for col in df.columns:
        missing_count = int(df[col].isnull().sum())
        missing_values[col] = missing_count
        missing_values_percent[col] = round(float(missing_count / len(df) * 100), 2) if len(df) > 0 else 0.0
    
    # Detect duplicate rows
    duplicate_rows = int(df.duplicated().sum())
    duplicate_percentage = round(float(duplicate_rows / len(df) * 100), 2) if len(df) > 0 else 0.0
    
    # Detect outliers using multiple methods
    outliers = {}
    outliers_percent = {}
    for col in df.select_dtypes(include=[np.number]).columns:
        outlier_count = detect_outliers_iqr(df[col].dropna())
        outliers[col] = outlier_count
        total_rows = len(df[col].dropna())
        outliers_percent[col] = round(float(outlier_count / total_rows * 100), 2) if total_rows > 0 else 0.0
    
    # Detect categorical inconsistencies (case, whitespace, etc.)
    inconsistent_categories = {}
    for col in df.select_dtypes(include=['object', 'category']).columns:
        clean_series = df[col].dropna().astype(str)
        if len(clean_series) == 0:
            continue
            
        # Check for case inconsistencies
        unique_vals = clean_series.unique()
        lower_vals = {v.lower().strip(): v for v in unique_vals}
        
        case_issues = []
        for lower_val, original in lower_vals.items():
            matches = [v for v in unique_vals if v.lower().strip() == lower_val]
            if len(matches) > 1:
                case_issues.extend(matches[1:])  # Keep first, mark others as inconsistent
        
        # Check for whitespace issues
        whitespace_issues = [v for v in unique_vals if v.strip() != v]
        
        all_issues = list(set(case_issues + whitespace_issues))[:10]  # Limit to 10
        if all_issues:
            inconsistent_categories[col] = all_issues
    
    # Detect class imbalance
    imbalanced_columns = {}
    for col in df.select_dtypes(include=['object', 'category']).columns:
        value_counts = df[col].value_counts()
        if 2 <= len(value_counts) <= 20:  # Only analyze with reasonable number of categories
            imbalanced_columns[col] = {str(k): int(v) for k, v in value_counts.items()}
    
    # Calculate quality scores
    completeness_score = calculate_completeness_score(df)
    consistency_score = calculate_consistency_score(df, outliers, inconsistent_categories)
    imbalance_score = calculate_imbalance_score(imbalanced_columns)
    overall_quality_score = calculate_overall_quality_score(completeness_score, consistency_score, imbalance_score)
    
    # Get column types
    column_types = {col: str(dtype) for col, dtype in df.dtypes.items()}
    
    # Calculate summary statistics for numeric columns
    summary_stats = {}
    for col in df.select_dtypes(include=[np.number]).columns:
        clean_series = df[col].dropna()
        if len(clean_series) == 0:
            continue
        summary_stats[col] = {
            "mean": round(float(clean_series.mean()), 4) if not pd.isna(clean_series.mean()) else None,
            "median": round(float(clean_series.median()), 4) if not pd.isna(clean_series.median()) else None,
            "std": round(float(clean_series.std()), 4) if not pd.isna(clean_series.std()) else None,
            "min": round(float(clean_series.min()), 4) if not pd.isna(clean_series.min()) else None,
            "max": round(float(clean_series.max()), 4) if not pd.isna(clean_series.max()) else None,
            "q25": round(float(clean_series.quantile(0.25)), 4) if not pd.isna(clean_series.quantile(0.25)) else None,
            "q75": round(float(clean_series.quantile(0.75)), 4) if not pd.isna(clean_series.quantile(0.75)) else None,
            "skewness": round(float(clean_series.skew()), 4) if not pd.isna(clean_series.skew()) else None,
            "kurtosis": round(float(clean_series.kurtosis()), 4) if not pd.isna(clean_series.kurtosis()) else None,
        }
    
    # Get unique value counts for categorical columns
    categorical_stats = {}
    for col in df.select_dtypes(include=['object', 'category']).columns:
        value_counts = df[col].value_counts()
        categorical_stats[col] = {
            "unique_count": int(df[col].nunique()),
            "most_common": str(value_counts.index[0]) if len(value_counts) > 0 else None,
            "most_common_count": int(value_counts.iloc[0]) if len(value_counts) > 0 else 0,
            "least_common": str(value_counts.index[-1]) if len(value_counts) > 0 else None,
            "least_common_count": int(value_counts.iloc[-1]) if len(value_counts) > 0 else 0,
        }
    
    analysis_data = {
        "dataset_id": dataset_id,
        "quality_score": overall_quality_score,
        "completeness_score": completeness_score,
        "consistency_score": consistency_score,
        "imbalance_score": imbalance_score,
        "row_count": len(df),
        "column_count": len(df.columns),
        "missing_values": missing_values,
        "missing_values_percent": missing_values_percent,
        "duplicate_rows": duplicate_rows,
        "duplicate_percentage": duplicate_percentage,
        "outliers": outliers,
        "outliers_percent": outliers_percent,
        "inconsistent_categories": inconsistent_categories,
        "imbalanced_columns": imbalanced_columns,
        "column_types": column_types,
        "summary_stats": summary_stats,
        "categorical_stats": categorical_stats,
    }
    
    return AnalysisResponse(**analysis_data)
