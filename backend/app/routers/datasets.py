import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, SubscriptionTier
from app.models.user import Dataset as DatasetModel
from app.schemas.dataset import DatasetResponse, DatasetPreview, ColumnInfo

router = APIRouter()

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

MAX_FILE_SIZES = {
    SubscriptionTier.free: 5 * 1024 * 1024,  # 5MB
    SubscriptionTier.pro: 100 * 1024 * 1024,  # 100MB
}


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
    
    max_size = MAX_FILE_SIZES.get(current_user.subscription_tier, 5 * 1024 * 1024)
    
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds {max_size // (1024*1024)}MB limit for {current_user.subscription_tier} plan"
        )
    
    if current_user.storage_used + len(content) > (5 * 1024 * 1024 * 1024 if current_user.subscription_tier == SubscriptionTier.pro else 100 * 1024 * 1024):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Storage limit exceeded"
        )
    
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
