import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, SubscriptionTier, PLAN_LIMITS
from app.models.user import Dataset as DatasetModel
from app.schemas.dataset import DatasetResponse, DatasetPreview, ColumnInfo

router = APIRouter()

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


def check_subscription_limits(user: User, file_size: int = 0, operation: bool = False):
    """Check if user has reached their subscription limits"""
    tier = user.subscription_tier.value if hasattr(user.subscription_tier, 'value') else str(user.subscription_tier)
    limits = PLAN_LIMITS.get(tier, PLAN_LIMITS["free"])
    
    if operation:
        max_ops = limits["max_daily_operations"]
        if max_ops > 0 and user.operations_used >= max_ops:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Daily operation limit reached. Upgrade to {tier.title()} plan for more."
            )
    
    if file_size > 0:
        max_size_mb = limits["max_file_size_mb"]
        max_size_bytes = max_size_mb * 1024 * 1024
        if file_size > max_size_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size exceeds {max_size_mb}MB limit for {tier} plan"
            )


def check_feature_access(user: User, feature: str):
    """Check if user has access to a specific feature"""
    tier = user.subscription_tier.value if hasattr(user.subscription_tier, 'value') else str(user.subscription_tier)
    limits = PLAN_LIMITS.get(tier, PLAN_LIMITS["free"])
    
    feature_map = {
        "advanced_cleaning": "Advanced cleaning features",
        "quality_reports": "Quality reports",
        "api_access": "API access",
        "team_workspace": "Team workspace",
    }
    
    if feature in limits and not limits[feature]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{feature_map.get(feature, feature)} is not available on your plan"
        )


@router.post("/upload", response_model=DatasetResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are allowed"
        )
    
    content = await file.read()
    file_size = len(content)
    
    check_subscription_limits(current_user, file_size=file_size)
    
    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{file_id}.csv"
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    import pandas as pd
    from io import StringIO
    
    df = pd.read_csv(StringIO(content.decode('utf-8')))
    
    columns = []
    for col in df.columns:
        col_info = {
            "name": col,
            "dtype": str(df[col].dtype),
            "nullable": df[col].isnull().any(),
            "unique_count": int(df[col].nunique())
        }
        columns.append(col_info)
    
    dataset = DatasetModel(
        id=uuid.UUID(file_id),
        user_id=current_user.id,
        name=file.filename.replace('.csv', ''),
        original_filename=file.filename,
        file_path=str(file_path),
        file_size=len(content),
        row_count=len(df),
        column_count=len(df.columns),
        columns=columns
    )
    
    current_user.storage_used += len(content)
    
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    
    return dataset


@router.get("", response_model=list[DatasetResponse])
async def list_datasets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    datasets = db.query(DatasetModel).filter(DatasetModel.user_id == current_user.id).all()
    return datasets


@router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(
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
    
    return dataset


@router.delete("/{dataset_id}")
async def delete_dataset(
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
    
    if os.path.exists(dataset.file_path):
        os.remove(dataset.file_path)
    
    current_user.storage_used -= dataset.file_size
    
    db.delete(dataset)
    db.commit()
    
    return {"message": "Dataset deleted successfully"}


@router.get("/{dataset_id}/preview", response_model=DatasetPreview)
async def preview_dataset(
    dataset_id: uuid.UUID,
    page: int = 1,
    page_size: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(DatasetModel).filter(
        DatasetModel.id == dataset_id,
        DatasetModel.user_id == current_user.id
    ).first()
    
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    import pandas as pd
    df = pd.read_csv(dataset.file_path)
    
    start = (page - 1) * page_size
    end = start + page_size
    preview_df = df.iloc[start:end]
    
    return DatasetPreview(
        columns=df.columns.tolist(),
        rows=preview_df.values.tolist(),
        total_rows=len(df)
    )


@router.get("/{dataset_id}/download")
async def download_dataset(
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
    
    from fastapi.responses import FileResponse
    
    return FileResponse(
        path=dataset.file_path,
        filename=f"{dataset.name}_cleaned.csv",
        media_type="text/csv"
    )
