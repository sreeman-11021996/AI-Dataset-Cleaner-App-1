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


def calculate_quality_score(analysis: dict) -> float:
    score = 100.0
    
    total_missing = sum(analysis.get("missing_values", {}).values())
    total_cells = analysis.get("row_count", 1) * analysis.get("column_count", 1)
    if total_cells > 0:
        score -= (total_missing / total_cells) * 50
    
    dup_ratio = analysis.get("duplicate_rows", 0) / max(analysis.get("row_count", 1), 1)
    score -= dup_ratio * 30
    
    total_outliers = sum(analysis.get("outliers", {}).values())
    score -= (total_outliers / max(total_cells, 1)) * 20
    
    return max(0, min(100, round(score, 1)))


def detect_outliers_iqr(series: pd.Series) -> int:
    Q1 = series.quantile(0.25)
    Q3 = series.quantile(0.75)
    IQR = Q3 - Q1
    lower = Q1 - 1.5 * IQR
    upper = Q3 + 1.5 * IQR
    return ((series < lower) | (series > upper)).sum()


def detect_outliers_zscore(series: pd.Series, threshold: float = 3.0) -> int:
    mean = series.mean()
    std = series.std()
    if std == 0:
        return 0
    z_scores = np.abs((series - mean) / std)
    return (z_scores > threshold).sum()


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
    
    df = pd.read_csv(dataset.file_path)
    
    missing_values = {}
    missing_values_percent = {}
    for col in df.columns:
        missing_values[col] = int(df[col].isnull().sum())
        missing_values_percent[col] = round(float(df[col].isnull().sum() / len(df) * 100), 2)
    
    duplicate_rows = int(df.duplicated().sum())
    
    outliers = {}
    for col in df.select_dtypes(include=[np.number]).columns:
        outliers[col] = detect_outliers_iqr(df[col].dropna())
    
    inconsistent_categories = {}
    for col in df.select_dtypes(include=['object']).columns:
        unique_vals = df[col].dropna().unique()
        normalized = {str(v).strip().lower(): str(v) for v in unique_vals}
        issues = set()
        for original, normalized_val in normalized.items():
            if normalized_val != original:
                issues.add(original)
        if issues:
            inconsistent_categories[col] = list(issues)[:5]
    
    imbalanced_columns = {}
    for col in df.select_dtypes(include=['object', 'category']).columns:
        value_counts = df[col].value_counts()
        if len(value_counts) <= 10:
            imbalanced_columns[col] = {str(k): int(v) for k, v in value_counts.items()}
    
    column_types = {col: str(dtype) for col, dtype in df.dtypes.items()}
    
    summary_stats = {}
    for col in df.select_dtypes(include=[np.number]).columns:
        summary_stats[col] = {
            "mean": round(float(df[col].mean()), 4) if not pd.isna(df[col].mean()) else None,
            "median": round(float(df[col].median()), 4) if not pd.isna(df[col].median()) else None,
            "std": round(float(df[col].std()), 4) if not pd.isna(df[col].std()) else None,
            "min": round(float(df[col].min()), 4) if not pd.isna(df[col].min()) else None,
            "max": round(float(df[col].max()), 4) if not pd.isna(df[col].max()) else None,
            "q25": round(float(df[col].quantile(0.25)), 4) if not pd.isna(df[col].quantile(0.25)) else None,
            "q75": round(float(df[col].quantile(0.75)), 4) if not pd.isna(df[col].quantile(0.75)) else None,
        }
    
    analysis_data = {
        "dataset_id": dataset_id,
        "quality_score": 0.0,
        "row_count": len(df),
        "column_count": len(df.columns),
        "missing_values": missing_values,
        "missing_values_percent": missing_values_percent,
        "duplicate_rows": duplicate_rows,
        "outliers": outliers,
        "inconsistent_categories": inconsistent_categories,
        "imbalanced_columns": imbalanced_columns,
        "column_types": column_types,
        "summary_stats": summary_stats
    }
    
    analysis_data["quality_score"] = calculate_quality_score(analysis_data)
    
    return AnalysisResponse(**analysis_data)
