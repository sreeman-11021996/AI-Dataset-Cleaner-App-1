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
    
    df = pd.read_csv(dataset.file_path)
    suggestions = []
    
    dup_count = df.duplicated().sum()
    if dup_count > 0:
        suggestions.append(CleaningSuggestion(
            id="remove_duplicates",
            operation_type="remove_duplicates",
            description=f"Remove {dup_count} duplicate rows",
            affected_rows=dup_count
        ))
    
    for col in df.columns:
        missing = df[col].isnull().sum()
        if missing > 0:
            pct = missing / len(df) * 100
            if pct > 50:
                suggestions.append(CleaningSuggestion(
                    id=f"drop_column_{col}",
                    operation_type="drop_column",
                    description=f"Drop column '{col}' ({pct:.1f}% missing values)",
                    column=col,
                    affected_rows=missing
                ))
            else:
                suggestions.append(CleaningSuggestion(
                    id=f"fill_missing_{col}",
                    operation_type="fill_missing",
                    description=f"Fill missing values in '{col}' ({missing} missing)",
                    column=col,
                    affected_rows=missing
                ))
    
    for col in df.select_dtypes(include=[np.number]).columns:
        Q1 = df[col].quantile(0.25)
        Q3 = df[col].quantile(0.75)
        IQR = Q3 - Q1
        lower = Q1 - 1.5 * IQR
        upper = Q3 + 1.5 * IQR
        outliers = ((df[col] < lower) | (df[col] > upper)).sum()
        if outliers > 0:
            suggestions.append(CleaningSuggestion(
                id=f"remove_outliers_{col}",
                operation_type="remove_outliers",
                description=f"Remove {outliers} outliers from '{col}'",
                column=col,
                affected_rows=outliers
            ))
    
    for col in df.select_dtypes(include=['object']).columns:
        df[col] = df[col].astype(str).str.strip()
        dupes = df[col].duplicated().sum()
        if dupes > 0:
            suggestions.append(CleaningSuggestion(
                id=f"trim_whitespace_{col}",
                operation_type="trim_whitespace",
                description=f"Trim whitespace in '{col}'",
                column=col,
                affected_rows=dupes
            ))
        
        unique_vals = df[col].unique()
        normalized = {v.lower(): v for v in unique_vals if v != 'nan'}
        case_issues = [v for k, v in normalized.items() if k != v]
        if case_issues:
            suggestions.append(CleaningSuggestion(
                id=f"standardize_case_{col}",
                operation_type="standardize_case",
                description=f"Standardize case in '{col}'",
                column=col,
                affected_rows=len(case_issues)
            ))
    
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if numeric_cols:
        suggestions.append(CleaningSuggestion(
            id="normalize_numeric",
            operation_type="normalize",
            description="Normalize numeric columns (min-max scaling)",
            affected_rows=len(df)
        ))
    
    categorical_cols = df.select_dtypes(include=['object']).columns.tolist()
    for col in categorical_cols:
        if df[col].nunique() <= 10:
            suggestions.append(CleaningSuggestion(
                id=f"encode_{col}",
                operation_type="encode_categorical",
                description=f"One-hot encode '{col}' ({df[col].nunique()} categories)",
                column=col
            ))
    
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
    
    df = pd.read_csv(dataset.file_path)
    original_rows = len(df)
    
    operations_applied = []
    
    for op in cleaning_request.operations:
        op_type = op.get("operation_type")
        
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
            method = op.get("method", "mean")
            if col in df.columns:
                if method == "mean" and pd.api.types.is_numeric_dtype(df[col]):
                    df[col] = df[col].fillna(df[col].mean())
                elif method == "median" and pd.api.types.is_numeric_dtype(df[col]):
                    df[col] = df[col].fillna(df[col].median())
                elif method == "mode":
                    df[col] = df[col].fillna(df[col].mode()[0] if not df[col].mode().empty else "")
                elif method == "forward_fill":
                    df[col] = df[col].fillna(method='ffill')
                else:
                    df[col] = df[col].fillna("")
                operations_applied.append(f"fill_missing:{col}")
        
        elif op_type == "remove_outliers":
            col = op.get("column")
            if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
                Q1 = df[col].quantile(0.25)
                Q3 = df[col].quantile(0.75)
                IQR = Q3 - Q1
                lower = Q1 - 1.5 * IQR
                upper = Q3 + 1.5 * IQR
                df = df[~((df[col] < lower) | (df[col] > upper))]
                operations_applied.append(f"remove_outliers:{col}")
        
        elif op_type == "trim_whitespace":
            col = op.get("column")
            if col in df.columns:
                df[col] = df[col].astype(str).str.strip()
                operations_applied.append(f"trim_whitespace:{col}")
        
        elif op_type == "standardize_case":
            col = op.get("column")
            if col in df.columns:
                df[col] = df[col].astype(str).str.lower()
                operations_applied.append(f"standardize_case:{col}")
        
        elif op_type == "normalize":
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            for col in numeric_cols:
                min_val = df[col].min()
                max_val = df[col].max()
                if max_val > min_val:
                    df[col] = (df[col] - min_val) / (max_val - min_val)
            operations_applied.append("normalize")
        
        elif op_type == "encode_categorical":
            col = op.get("column")
            if col in df.columns:
                dummies = pd.get_dummies(df[col], prefix=col)
                df = pd.concat([df, dummies], axis=1)
                df = df.drop(columns=[col])
                operations_applied.append(f"encode_categorical:{col}")
    
    df.to_csv(dataset.file_path, index=False)
    
    new_row_count = len(df)
    dataset.row_count = new_row_count
    dataset.column_count = len(df.columns)
    
    columns = []
    for col in df.columns:
        col_info = {
            "name": col,
            "dtype": str(df[col].dtype),
            "nullable": df[col].isnull().any(),
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
