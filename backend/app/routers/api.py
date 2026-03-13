import os
import uuid
import secrets
import hashlib
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db
from app.models.user import User, SubscriptionTier, PLAN_LIMITS
from app.models.user import Dataset as DatasetModel

router = APIRouter()

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


def verify_api_key(api_key: Optional[str], db: Session):
    """Verify API key and return user if valid"""
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key is required"
        )
    
    user = db.query(User).filter(User.api_key == api_key).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    
    tier = user.subscription_tier.value if hasattr(user.subscription_tier, 'value') else str(user.subscription_tier)
    limits = PLAN_LIMITS.get(tier, PLAN_LIMITS["free"])
    
    if not limits.get("api_access", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API access is only available for Team plan"
        )
    
    return user


def check_api_limits(user: User, file_size: int = 0):
    """Check API rate limits"""
    tier = user.subscription_tier.value if hasattr(user.subscription_tier, 'value') else str(user.subscription_tier)
    limits = PLAN_LIMITS.get(tier, PLAN_LIMITS["free"])
    
    if file_size > 0:
        max_size_mb = limits["max_file_size_mb"]
        max_size_bytes = max_size_mb * 1024 * 1024
        if file_size > max_size_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size exceeds {max_size_mb}MB limit"
            )


class UploadResponse(BaseModel):
    dataset_id: str
    name: str
    file_size: int
    row_count: int
    column_count: int
    columns: List[dict]


class CleanRequest(BaseModel):
    operations: List[dict]


class CleanResponse(BaseModel):
    dataset_id: str
    status: str
    operations_applied: int
    rows_affected: int
    cleaned_file_path: Optional[str] = None


class DatasetListResponse(BaseModel):
    datasets: List[dict]
    total: int


class DatasetDetailResponse(BaseModel):
    id: str
    name: str
    file_size: int
    row_count: int
    column_count: int
    columns: List[dict]
    created_at: str


@router.post("/upload_dataset", response_model=UploadResponse)
async def upload_dataset_api(
    file: bytes = ...,
    filename: str = ...,
    x_api_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Upload a dataset via API"""
    user = verify_api_key(x_api_key, db)
    
    if not filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are allowed"
        )
    
    check_api_limits(user, len(file))
    
    import pandas as pd
    from io import StringIO
    
    df = pd.read_csv(StringIO(file.decode('utf-8')))
    
    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{file_id}.csv"
    
    with open(file_path, "wb") as f:
        f.write(file)
    
    columns = []
    for col in df.columns:
        col_info = {
            "name": col,
            "dtype": str(df[col].dtype),
            "nullable": bool(df[col].isnull().any()),
            "unique_count": int(df[col].nunique())
        }
        columns.append(col_info)
    
    dataset = DatasetModel(
        id=uuid.UUID(file_id),
        user_id=user.id,
        name=filename.replace('.csv', ''),
        original_filename=filename,
        file_path=str(file_path),
        file_size=len(file),
        row_count=len(df),
        column_count=len(df.columns),
        columns=columns
    )
    db.add(dataset)
    db.commit()
    
    return UploadResponse(
        dataset_id=file_id,
        name=filename.replace('.csv', ''),
        file_size=len(file),
        row_count=len(df),
        column_count=len(df.columns),
        columns=columns
    )


@router.post("/clean_dataset", response_model=CleanResponse)
async def clean_dataset_api(
    dataset_id: str,
    operations: List[dict],
    x_api_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Clean a dataset via API"""
    user = verify_api_key(x_api_key, db)
    
    try:
        dataset_uuid = uuid.UUID(dataset_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid dataset ID"
        )
    
    dataset = db.query(DatasetModel).filter(
        DatasetModel.id == dataset_uuid,
        DatasetModel.user_id == user.id
    ).first()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )
    
    import pandas as pd
    
    try:
        df = pd.read_csv(dataset.file_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read dataset: {str(e)}"
        )
    
    original_rows = len(df)
    
    for op in operations:
        op_type = op.get("type")
        column = op.get("column")
        
        try:
            if op_type == "remove_duplicates":
                df = df.drop_duplicates()
                
            elif op_type == "fill_missing" and column:
                method = op.get("method", "mean")
                if method == "mean":
                    df[column] = df[column].fillna(df[column].mean())
                elif method == "median":
                    df[column] = df[column].fillna(df[column].median())
                elif method == "mode":
                    df[column] = df[column].fillna(df[column].mode()[0])
                elif method == "forward":
                    df[column] = df[column].fillna(method='ffill')
                elif method == "backward":
                    df[column] = df[column].fillna(method='bfill')
                else:
                    df[column] = df[column].fillna(0)
                    
            elif op_type == "remove_outliers" and column:
                method = op.get("method", "iqr")
                if method == "iqr":
                    Q1 = df[column].quantile(0.25)
                    Q3 = df[column].quantile(0.75)
                    IQR = Q3 - Q1
                    df = df[(df[column] >= Q1 - 1.5*IQR) & (df[column] <= Q3 + 1.5*IQR)]
                elif method == "zscore":
                    mean = df[column].mean()
                    std = df[column].std()
                    df = df[abs((df[column] - mean) / std) < 3]
                    
            elif op_type == "normalize" and column:
                method = op.get("method", "minmax")
                if method == "minmax":
                    min_val = df[column].min()
                    max_val = df[column].max()
                    df[column] = (df[column] - min_val) / (max_val - min_val)
                elif method == "zscore":
                    mean = df[column].mean()
                    std = df[column].std()
                    df[column] = (df[column] - mean) / std
                    
            elif op_type == "encode_categorical" and column:
                df[column] = df[column].astype('category').cat.codes
                
            elif op_type == "drop_column" and column:
                df = df.drop(columns=[column])
                
            elif op_type == "rename_column":
                old_name = op.get("old_name")
                new_name = op.get("new_name")
                if old_name and new_name:
                    df = df.rename(columns={old_name: new_name})
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Operation {op_type} failed: {str(e)}"
            )
    
    new_file_id = str(uuid.uuid4())
    new_file_path = UPLOAD_DIR / f"{new_file_id}.csv"
    df.to_csv(new_file_path, index=False)
    
    new_columns = []
    for col in df.columns:
        col_info = {
            "name": col,
            "dtype": str(df[col].dtype),
            "nullable": bool(df[col].isnull().any()),
            "unique_count": int(df[col].nunique())
        }
        new_columns.append(col_info)
    
    cleaned_dataset = DatasetModel(
        id=uuid.UUID(new_file_id),
        user_id=user.id,
        name=dataset.name + "_cleaned",
        original_filename=dataset.original_filename,
        file_path=str(new_file_path),
        file_size=new_file_path.stat().st_size,
        row_count=len(df),
        column_count=len(df.columns),
        columns=new_columns
    )
    db.add(cleaned_dataset)
    db.commit()
    
    return CleanResponse(
        dataset_id=new_file_id,
        status="success",
        operations_applied=len(operations),
        rows_affected=original_rows - len(df),
        cleaned_file_path=f"/api/download_dataset?dataset_id={new_file_id}"
    )


@router.get("/download_dataset")
async def download_dataset_api(
    dataset_id: str,
    x_api_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Download a cleaned dataset via API"""
    user = verify_api_key(x_api_key, db)
    
    try:
        dataset_uuid = uuid.UUID(dataset_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid dataset ID"
        )
    
    dataset = db.query(DatasetModel).filter(
        DatasetModel.id == dataset_uuid,
        DatasetModel.user_id == user.id
    ).first()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )
    
    if not os.path.exists(dataset.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    return FileResponse(
        path=dataset.file_path,
        filename=dataset.original_filename or "dataset.csv",
        media_type="text/csv"
    )


@router.get("/datasets", response_model=DatasetListResponse)
async def list_datasets_api(
    limit: int = 10,
    offset: int = 0,
    x_api_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """List user's datasets via API"""
    user = verify_api_key(x_api_key, db)
    
    datasets = db.query(DatasetModel).filter(
        DatasetModel.user_id == user.id
    ).order_by(DatasetModel.created_at.desc()).offset(offset).limit(limit).all()
    
    total = db.query(DatasetModel).filter(DatasetModel.user_id == user.id).count()
    
    return DatasetListResponse(
        datasets=[
            {
                "id": str(d.id),
                "name": d.name,
                "file_size": d.file_size,
                "row_count": d.row_count,
                "column_count": d.column_count,
                "created_at": d.created_at.isoformat()
            }
            for d in datasets
        ],
        total=total
    )


@router.get("/datasets/{dataset_id}", response_model=DatasetDetailResponse)
async def get_dataset_api(
    dataset_id: str,
    x_api_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get dataset details via API"""
    user = verify_api_key(x_api_key, db)
    
    try:
        dataset_uuid = uuid.UUID(dataset_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid dataset ID"
        )
    
    dataset = db.query(DatasetModel).filter(
        DatasetModel.id == dataset_uuid,
        DatasetModel.user_id == user.id
    ).first()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )
    
    return DatasetDetailResponse(
        id=str(dataset.id),
        name=dataset.name,
        file_size=dataset.file_size,
        row_count=dataset.row_count,
        column_count=dataset.column_count,
        columns=dataset.columns,
        created_at=dataset.created_at.isoformat()
    )


@router.delete("/datasets/{dataset_id}")
async def delete_dataset_api(
    dataset_id: str,
    x_api_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Delete a dataset via API"""
    user = verify_api_key(x_api_key, db)
    
    try:
        dataset_uuid = uuid.UUID(dataset_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid dataset ID"
        )
    
    dataset = db.query(DatasetModel).filter(
        DatasetModel.id == dataset_uuid,
        DatasetModel.user_id == user.id
    ).first()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )
    
    if os.path.exists(dataset.file_path):
        os.remove(dataset.file_path)
    
    db.delete(dataset)
    db.commit()
    
    return {"status": "deleted", "dataset_id": dataset_id}
