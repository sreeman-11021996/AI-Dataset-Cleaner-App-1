import uuid
import pandas as pd
import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.user import Dataset as DatasetModel
from app.models.user import CleaningOperation
from app.schemas.dataset import CleaningSuggestion, CleaningRequest
from typing import List

router = APIRouter()


def detect_column_type(df: pd.DataFrame, col: str) -> str:
    """Detect the type of column"""
    if pd.api.types.is_numeric_dtype(df[col]):
        if df[col].nunique() <= 10:
            return "numeric_categorical"
        return "numeric_continuous"
    elif pd.api.types.is_datetime64_any_dtype(df[col]):
        return "datetime"
    elif df[col].nunique() == df[col].count():
        return "identifier"
    elif df[col].nunique() <= 20:
        return "categorical"
    else:
        return "text"


def analyze_skewness(series: pd.Series) -> str:
    """Analyze skewness of numeric data"""
    clean = series.dropna()
    if len(clean) == 0:
        return "unknown"
    skew = clean.skew()
    if abs(skew) < 0.5:
        return "symmetric"
    elif skew > 1:
        return "highly_positive"
    elif skew < -1:
        return "highly_negative"
    else:
        return "moderately_skewed"


def get_missing_value_recommendation(col: str, missing_count: int, total_rows: int, dtype: str) -> dict:
    """Generate recommendation for missing values"""
    missing_pct = (missing_count / total_rows) * 100
    
    if missing_pct > 50:
        return {
            "operation_type": "drop_column",
            "description": f"Drop column '{col}' - {missing_pct:.1f}% values missing",
            "issue_detected": f"Column has {missing_count} missing values ({missing_pct:.1f}% of data)",
            "recommendation": "Drop this column as it has too many missing values to be useful",
            "strategy": "drop_column",
            "priority": 1
        }
    
    strategies = []
    if pd.api.types.is_numeric_dtype(dtype):
        strategies = ["mean", "median", "forward_fill", "interpolation"]
        default_strategy = "median"  # More robust to outliers
    else:
        strategies = ["mode", "forward_fill", "constant"]
        default_strategy = "mode"
    
    return {
        "operation_type": "fill_missing",
        "description": f"Fill {missing_count} missing values in '{col}'",
        "issue_detected": f"Column has {missing_count} missing values ({missing_pct:.1f}%)",
        "recommendation": f"Use {default_strategy} imputation - best for {pd.api.types.is_numeric_dtype(dtype) and 'numeric' or 'categorical'} data",
        "strategy": default_strategy,
        "strategy_options": strategies,
        "priority": 2
    }


def get_outlier_recommendation(col: str, outlier_count: int, dtype: str) -> dict:
    """Generate recommendation for outliers"""
    return {
        "operation_type": "remove_outliers",
        "description": f"Handle {outlier_count} outliers in '{col}'",
        "issue_detected": f"Column contains {outlier_count} statistical outliers (IQR method)",
        "recommendation": "Remove outliers using IQR method to improve model accuracy",
        "strategy": "iqr",
        "strategy_options": ["iqr", "zscore", "winsorize"],
        "priority": 2
    }


def get_categorical_recommendation(col: str, unique_count: int, total_rows: int) -> dict:
    """Generate recommendation for categorical columns"""
    cardinality_ratio = unique_count / total_rows
    
    if cardinality_ratio > 0.5:
        return {
            "operation_type": "label_encode",
            "description": f"Apply label encoding to '{col}' ({unique_count} unique values)",
            "issue_detected": f"High cardinality: {unique_count} unique values ({cardinality_ratio*100:.1f}% of rows)",
            "recommendation": "Use Label Encoding - one-hot would create too many columns",
            "strategy": "label_encode",
            "strategy_options": ["label_encode", "target_encode", "frequency_encode"],
            "priority": 2
        }
    else:
        return {
            "operation_type": "encode_categorical",
            "description": f"One-hot encode '{col}' ({unique_count} categories)",
            "issue_detected": f"Low cardinality: {unique_count} categories suitable for one-hot encoding",
            "recommendation": "Use One-Hot Encoding to create binary features for each category",
            "strategy": "onehot",
            "strategy_options": ["onehot", "label_encode"],
            "priority": 3
        }


def get_numeric_recommendation(col: str, skewness: str, min_val: float, max_val: float) -> dict:
    """Generate recommendation for numeric columns"""
    strategies = []
    
    if abs(min_val) > 1000 or (max_val - min_val) > 10000:
        strategies.append("log_transform")
        strategies.append("standardize")
    
    if skewness in ["highly_positive", "highly_negative"]:
        strategies.append("log_transform")
        strategies.append("box_cox")
    
        if not strategies:
            strategies = ["standardize", "normalize"]
    
    return {
        "operation_type": "normalize",
        "description": f"Scale '{col}' for better model performance",
        "issue_detected": f"Skewness: {skewness}, Range: [{min_val:.2f}, {max_val:.2f}]",
        "recommendation": "Apply scaling to normalize the distribution",
        "strategy": strategies[0],
        "strategy_options": strategies,
        "priority": 3
    }


def get_text_recommendation(col: str, unique_count: int, total_rows: int) -> dict:
    """Generate recommendation for text columns"""
    return {
        "operation_type": "text_cleaning",
        "description": f"Clean text in '{col}'",
        "issue_detected": f"Text column with {unique_count} unique values",
        "recommendation": "Apply text preprocessing: lowercase, remove special chars, tokenize",
        "strategy": "basic_cleaning",
        "strategy_options": ["basic_cleaning", "nlp_preprocess", "extract_features"],
        "priority": 3
    }


def get_inconsistency_recommendation(col: str, issue_type: str, affected: int) -> dict:
    """Generate recommendation for inconsistent data"""
    if issue_type == "whitespace":
        return {
            "operation_type": "trim_whitespace",
            "description": f"Trim whitespace in '{col}'",
            "issue_detected": f"{affected} values have leading/trailing whitespace",
            "recommendation": "Trim whitespace to standardize values",
            "strategy": "strip",
            "strategy_options": ["strip", "normalize_spaces"],
            "priority": 1
        }
    elif issue_type == "case":
        return {
            "operation_type": "standardize_case",
            "description": f"Standardize case in '{col}'",
            "issue_detected": f"{affected} values have inconsistent casing",
            "recommendation": "Convert to lowercase for consistency",
            "strategy": "lowercase",
            "strategy_options": ["lowercase", "uppercase", "title_case"],
            "priority": 1
        }
    else:
        return {
            "operation_type": "standardize",
            "description": f"Standardize values in '{col}'",
            "issue_detected": f"{affected} inconsistent values detected",
            "recommendation": "Standardize to improve data consistency",
            "strategy": "normalize",
            "priority": 2
        }


@router.get("/{dataset_id}/suggestions", response_model=List[CleaningSuggestion])
async def get_cleaning_suggestions(
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
            df = pd.read_csv(dataset.file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read dataset: {str(e)}")
    
    suggestions = []
    total_rows = len(df)
    
    # Check for duplicates
    dup_count = df.duplicated().sum()
    if dup_count > 0:
        suggestions.append(CleaningSuggestion(
            id="remove_duplicates",
            operation_type="remove_duplicates",
            description=f"Remove {dup_count} duplicate rows",
            issue_detected=f"Found {dup_count} duplicate rows ({dup_count/total_rows*100:.1f}% of data)",
            recommendation="Remove exact duplicate rows to prevent data leakage",
            affected_rows=dup_count,
            priority=1
        ))
    
    # Analyze each column
    for col in df.columns:
        col_type = detect_column_type(df, col)
        missing = df[col].isnull().sum()
        
        # Missing values
        if missing > 0:
            rec = get_missing_value_recommendation(col, missing, total_rows, df[col].dtype)
            suggestions.append(CleaningSuggestion(
                id=f"fill_missing_{col}",
                column=col,
                column_type=col_type,
                affected_rows=missing,
                priority=rec["priority"],
                **rec
            ))
        
        # Numeric columns - check for outliers
        if pd.api.types.is_numeric_dtype(df[col]):
            clean_series = df[col].dropna()
            if len(clean_series) > 0:
                Q1 = clean_series.quantile(0.25)
                Q3 = clean_series.quantile(0.75)
                IQR = Q3 - Q1
                lower = Q1 - 1.5 * IQR
                upper = Q3 + 1.5 * IQR
                outliers = ((clean_series < lower) | (clean_series > upper)).sum()
                
                if outliers > 0:
                    rec = get_outlier_recommendation(col, outliers, str(df[col].dtype))
                    suggestions.append(CleaningSuggestion(
                        id=f"remove_outliers_{col}",
                        column=col,
                        column_type=col_type,
                        affected_rows=outliers,
                        priority=rec["priority"],
                        **rec
                    ))
                
                # Check for skewness and recommend normalization
                if len(clean_series) > 10:
                    skewness = analyze_skewness(clean_series)
                    if skewness != "symmetric":
                        rec = get_numeric_recommendation(
                            col, skewness, 
                            float(clean_series.min()), 
                            float(clean_series.max())
                        )
                        suggestions.append(CleaningSuggestion(
                            id=f"normalize_{col}",
                            column=col,
                            column_type=col_type,
                            affected_rows=len(clean_series),
                            priority=rec["priority"],
                            **rec
                        ))
        
        # Categorical/text columns - check for inconsistencies
        if df[col].dtype == 'object':
            clean_series = df[col].dropna().astype(str)
            if len(clean_series) > 0:
                # Check whitespace issues
                whitespace_issues = (clean_series != clean_series.str.strip()).sum()
                if whitespace_issues > 0:
                    rec = get_inconsistency_recommendation(col, "whitespace", whitespace_issues)
                    suggestions.append(CleaningSuggestion(
                        id=f"trim_{col}",
                        column=col,
                        column_type=col_type,
                        affected_rows=whitespace_issues,
                        priority=rec["priority"],
                        **rec
                    ))
                
                # Check case inconsistencies
                unique_vals = clean_series.unique()
                lower_vals = {v.lower().strip(): v for v in unique_vals}
                case_issues = len([v for k, v in lower_vals.items() if k != v.strip()])
                if case_issues > 0:
                    rec = get_inconsistency_recommendation(col, "case", case_issues)
                    suggestions.append(CleaningSuggestion(
                        id=f"case_{col}",
                        column=col,
                        column_type=col_type,
                        affected_rows=case_issues,
                        priority=rec["priority"],
                        **rec
                    ))
                
                # Categorical encoding recommendations
                unique_count = df[col].nunique()
                if unique_count <= 20:
                    rec = get_categorical_recommendation(col, unique_count, total_rows)
                    suggestions.append(CleaningSuggestion(
                        id=f"encode_{col}",
                        column=col,
                        column_type=col_type,
                        priority=rec["priority"],
                        **rec
                    ))
                elif unique_count > 20 and unique_count < total_rows * 0.5:
                    rec = get_text_recommendation(col, unique_count, total_rows)
                    suggestions.append(CleaningSuggestion(
                        id=f"text_{col}",
                        column=col,
                        column_type=col_type,
                        priority=rec["priority"],
                        **rec
                    ))
    
    # Global recommendations
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if numeric_cols:
        # Check if normalization would help
        has_large_range = False
        for col in numeric_cols[:3]:
            clean = df[col].dropna()
            if len(clean) > 0 and clean.max() - clean.min() > 1000:
                has_large_range = True
                break
        
        if has_large_range:
            suggestions.append(CleaningSuggestion(
                id="normalize_numeric",
                operation_type="normalize",
                description="Normalize all numeric columns (min-max scaling)",
                issue_detected="Numeric columns have varying scales",
                recommendation="Apply min-max scaling to normalize all numeric features to [0,1] range",
                strategy="minmax",
                strategy_options=["minmax", "standardize", "robust"],
                priority=3
            ))
    
    # Sort by priority
    suggestions.sort(key=lambda x: x.priority if x.priority else 3)
    
    return suggestions


@router.post("/{dataset_id}/clean", response_model=dict)
async def clean_dataset(
    dataset_id: uuid.UUID,
    cleaning_request: CleaningRequest,
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
            df = pd.read_csv(dataset.file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read dataset: {str(e)}")
    
    original_rows = len(df)
    operations_applied = []
    
    for op in cleaning_request.operations:
        op_type = op.get("operation_type")
        strategy = op.get("strategy", "mean")  # Default strategy
        
        try:
            if op_type == "remove_duplicates":
                df = df.drop_duplicates()
                operations_applied.append("remove_duplicates")
            
            elif op_type == "drop_column":
                col = op.get("column")
                if col in df.columns:
                    df = df.drop(columns=[col])
                    operations_applied.append(f"drop_column:{col}")
            
            elif op_type == "fill_missing":
                col = op.get("column")
                method = strategy
                if col in df.columns:
                    if method == "mean" and pd.api.types.is_numeric_dtype(df[col]):
                        df[col] = df[col].fillna(df[col].mean())
                    elif method == "median" and pd.api.types.is_numeric_dtype(df[col]):
                        df[col] = df[col].fillna(df[col].median())
                    elif method == "mode":
                        mode_val = df[col].mode()
                        df[col] = df[col].fillna(mode_val[0] if len(mode_val) > 0 else "")
                    elif method == "forward_fill":
                        df[col] = df[col].fillna(method='ffill')
                    elif method == "interpolation" and pd.api.types.is_numeric_dtype(df[col]):
                        df[col] = df[col].interpolate()
                    else:
                        df[col] = df[col].fillna("")
                    operations_applied.append(f"fill_missing:{col}:{method}")
            
            elif op_type == "remove_outliers":
                col = op.get("column")
                method = strategy
                if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
                    if method == "iqr":
                        Q1 = df[col].quantile(0.25)
                        Q3 = df[col].quantile(0.75)
                        IQR = Q3 - Q1
                        lower = Q1 - 1.5 * IQR
                        upper = Q3 + 1.5 * IQR
                        df = df[~((df[col] < lower) | (df[col] > upper))]
                    elif method == "zscore":
                        mean = df[col].mean()
                        std = df[col].std()
                        df = df[np.abs((df[col] - mean) / std) <= 3]
                    elif method == "winsorize":
                        lower = df[col].quantile(0.05)
                        upper = df[col].quantile(0.95)
                        df[col] = df[col].clip(lower, upper)
                    operations_applied.append(f"remove_outliers:{col}:{method}")
            
            elif op_type == "trim_whitespace":
                col = op.get("column")
                if col in df.columns:
                    df[col] = df[col].astype(str).str.strip()
                    operations_applied.append(f"trim_whitespace:{col}")
            
            elif op_type == "standardize_case":
                col = op.get("column")
                case_type = strategy
                if col in df.columns:
                    if case_type == "lowercase":
                        df[col] = df[col].astype(str).str.lower()
                    elif case_type == "uppercase":
                        df[col] = df[col].astype(str).str.upper()
                    elif case_type == "title_case":
                        df[col] = df[col].astype(str).str.title()
                    operations_applied.append(f"standardize_case:{col}:{case_type}")
            
            elif op_type == "normalize":
                method = strategy
                numeric_cols = df.select_dtypes(include=[np.number]).columns
                for col in numeric_cols:
                    if method == "minmax" or method == "normalize":
                        min_val = df[col].min()
                        max_val = df[col].max()
                        if max_val > min_val:
                            df[col] = (df[col] - min_val) / (max_val - min_val)
                    elif method == "standardize":
                        mean = df[col].mean()
                        std = df[col].std()
                        if std > 0:
                            df[col] = (df[col] - mean) / std
                    elif method == "robust":
                        median = df[col].median()
                        q75 = df[col].quantile(0.75)
                        q25 = df[col].quantile(0.25)
                        iqr = q75 - q25
                        if iqr > 0:
                            df[col] = (df[col] - median) / iqr
                operations_applied.append(f"normalize:{method}")
            
            elif op_type == "encode_categorical":
                col = op.get("column")
                method = strategy
                if col in df.columns:
                    if method == "onehot":
                        dummies = pd.get_dummies(df[col], prefix=col, drop_first=False)
                        df = pd.concat([df, dummies], axis=1)
                        df = df.drop(columns=[col])
                    elif method == "label_encode":
                        df[col] = pd.Categorical(df[col]).codes
                    operations_applied.append(f"encode_categorical:{col}:{method}")
            
            elif op_type == "label_encode":
                col = op.get("column")
                if col in df.columns:
                    df[col] = pd.Categorical(df[col]).codes
                    operations_applied.append(f"label_encode:{col}")
            
            elif op_type == "text_cleaning":
                col = op.get("column")
                if col in df.columns:
                    df[col] = df[col].astype(str).str.lower()
                    df[col] = df[col].str.replace(r'[^\w\s]', '', regex=True)
                    df[col] = df[col].str.replace(r'\s+', ' ', regex=True).str.strip()
                    operations_applied.append(f"text_cleaning:{col}")
                    
        except Exception as e:
            # Log but continue with other operations
            print(f"Error applying {op_type}: {str(e)}")
            continue
    
    # Save the cleaned dataset
    if dataset.original_filename.endswith('.csv'):
        df.to_csv(dataset.file_path, index=False)
    elif dataset.original_filename.endswith(('.xlsx', '.xls')):
        df.to_excel(dataset.file_path, index=False)
    else:
        df.to_csv(dataset.file_path, index=False)
    
    new_row_count = len(df)
    dataset.row_count = new_row_count
    dataset.column_count = len(df.columns)
    
    columns = []
    for col in df.columns:
        col_info = {
            "name": col,
            "dtype": str(df[col].dtype),
            "nullable": bool(df[col].isnull().any()),
            "unique_count": int(df[col].nunique())
        }
        columns.append(col_info)
    dataset.columns = columns
    
    cleaning_op = CleaningOperation(
        dataset_id=dataset_id,
        operation_type=",".join(operations_applied),
        parameters=cleaning_request.operations
    )
    db.add(cleaning_op)
    
    current_user.operations_used += len(cleaning_request.operations)
    
    db.commit()
    
    return {
        "message": "Dataset cleaned successfully",
        "operations_applied": operations_applied,
        "original_rows": original_rows,
        "new_rows": new_row_count,
        "rows_removed": original_rows - new_row_count
    }


@router.post("/{dataset_id}/auto-clean")
async def auto_clean_dataset(
    dataset_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Automatic cleaning pipeline that applies all standard cleaning operations"""
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
            df = pd.read_csv(dataset.file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read dataset: {str(e)}")
    
    original_rows = len(df)
    original_cols = len(df.columns)
    steps_completed = []
    steps_total = 5
    
    # Step 1: Remove duplicates
    dup_count = df.duplicated().sum()
    if dup_count > 0:
        df = df.drop_duplicates()
        steps_completed.append(f"Removed {dup_count} duplicate rows")
    
    # Step 2: Fill missing values
    missing_total = df.isnull().sum().sum()
    if missing_total > 0:
        for col in df.columns:
            missing = df[col].isnull().sum()
            if missing > 0:
                if pd.api.types.is_numeric_dtype(df[col]):
                    df[col] = df[col].fillna(df[col].median())
                else:
                    mode_val = df[col].mode()
                    if len(mode_val) > 0:
                        df[col] = df[col].fillna(mode_val[0])
                    else:
                        df[col] = df[col].fillna("")
        steps_completed.append(f"Filled {missing_total} missing values")
    
    # Step 3: Normalize numeric columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if numeric_cols:
        for col in numeric_cols:
            min_val = df[col].min()
            max_val = df[col].max()
            if max_val > min_val:
                df[col] = (df[col] - min_val) / (max_val - min_val)
        steps_completed.append(f"Normalized {len(numeric_cols)} numeric columns")
    
    # Step 4: Encode categorical variables
    categorical_cols = df.select_dtypes(include=['object']).columns.tolist()
    encoded_cols = 0
    for col in categorical_cols:
        unique_count = df[col].nunique()
        if unique_count <= 10 and unique_count > 1:
            dummies = pd.get_dummies(df[col], prefix=col, drop_first=True)
            df = pd.concat([df, dummies], axis=1)
            df = df.drop(columns=[col])
            encoded_cols += 1
    if encoded_cols > 0:
        steps_completed.append(f"Encoded {encoded_cols} categorical columns")
    
    # Step 5: Handle outliers (cap at IQR boundaries)
    for col in df.select_dtypes(include=[np.number]).columns:
        clean_series = df[col].dropna()
        if len(clean_series) > 0:
            Q1 = clean_series.quantile(0.25)
            Q3 = clean_series.quantile(0.75)
            IQR = Q3 - Q1
            if IQR > 0:
                lower = Q1 - 1.5 * IQR
                upper = Q3 + 1.5 * IQR
                df[col] = df[col].clip(lower, upper)
    steps_completed.append("Handled outliers in numeric columns")
    
    new_rows = len(df)
    new_cols = len(df.columns)
    
    # Save the cleaned dataset
    if dataset.original_filename.endswith('.csv'):
        df.to_csv(dataset.file_path, index=False)
    elif dataset.original_filename.endswith(('.xlsx', '.xls')):
        df.to_excel(dataset.file_path, index=False)
    else:
        df.to_csv(dataset.file_path, index=False)
    
    dataset.row_count = new_rows
    dataset.column_count = new_cols
    
    columns = []
    for col in df.columns:
        col_info = {
            "name": col,
            "dtype": str(df[col].dtype),
            "nullable": bool(df[col].isnull().any()),
            "unique_count": int(df[col].nunique())
        }
        columns.append(col_info)
    dataset.columns = columns
    
    cleaning_op = CleaningOperation(
        dataset_id=dataset_id,
        operation_type="auto_clean:" + ",".join(steps_completed),
        parameters=[{"operation": "auto_clean"}]
    )
    db.add(cleaning_op)
    
    current_user.operations_used += 1
    
    db.commit()
    
    return {
        "message": "Auto-clean completed successfully",
        "steps_completed": steps_completed,
        "steps_total": steps_total,
        "original_rows": original_rows,
        "new_rows": new_rows,
        "rows_removed": original_rows - new_rows,
        "original_columns": original_cols,
        "new_columns": new_cols,
        "columns_added": new_cols - original_cols
    }
