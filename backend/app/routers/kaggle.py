import os
import uuid
import re
import shutil
import tempfile
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.user import Dataset as DatasetModel

router = APIRouter()

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

KAGGLE_DATASET_PATTERN = re.compile(r'https?://(?:www\.)?kaggle\.com/datasets/([^/]+)/([^/?]+)')


class KaggleImportRequest(BaseModel):
    url: str


class KaggleImportResponse(BaseModel):
    dataset_id: str
    name: str
    original_filename: str
    file_size: int
    row_count: int
    column_count: int
    columns: List[dict]


def parse_kaggle_url(url: str) -> tuple:
    """Extract owner and dataset name from Kaggle URL"""
    match = KAGGLE_DATASET_PATTERN.match(url)
    if not match:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Kaggle URL format"
        )
    return match.group(1), match.group(2)


def download_kaggle_dataset(owner: str, dataset_name: str, temp_dir: Path) -> Path:
    """Download dataset from Kaggle and return the CSV file path"""
    try:
        from kaggle.api.kaggle_api_extended import KaggleApi
        api = KaggleApi()
        api.authenticate()
        
        dataset_dir = temp_dir / dataset_name
        api.dataset_download_files(
            f"{owner}/{dataset_name}",
            path=str(temp_dir),
            unzip=True,
            quiet=False
        )
        
        csv_files = list(temp_dir.glob("*.csv"))
        if not csv_files:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No CSV file found in Kaggle dataset"
            )
        
        return csv_files[0]
        
    except Exception as e:
        if "403" in str(e) or "Forbidden" in str(e):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Kaggle dataset requires authentication or is private"
            )
        elif "404" in str(e) or "Not Found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Kaggle dataset not found"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to download from Kaggle: {str(e)}"
            )


@router.post("/import/kaggle", response_model=KaggleImportResponse)
async def import_from_kaggle(
    request: KaggleImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Import a dataset from Kaggle"""
    try:
        owner, dataset_name = parse_kaggle_url(request.url)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Kaggle URL: {str(e)}"
        )
    
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            csv_path = download_kaggle_dataset(owner, dataset_name, Path(temp_dir))
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to download Kaggle dataset: {str(e)}"
            )
        
        file_size = csv_path.stat().st_size
        file_id = str(uuid.uuid4())
        
        dest_path = UPLOAD_DIR / f"{file_id}.csv"
        shutil.copy2(csv_path, dest_path)
        
        import pandas as pd
        df = pd.read_csv(dest_path)
        
        columns = []
        for col in df.columns:
            col_info = {
                "name": col,
                "dtype": str(df[col].dtype),
                "nullable": bool(df[col].isnull().any()),
                "unique_count": int(df[col].nunique())
            }
            columns.append(col_info)
        
        clean_name = dataset_name.replace('-', ' ').replace('_', ' ').title()
        
        dataset = DatasetModel(
            id=uuid.UUID(file_id),
            user_id=current_user.id,
            name=clean_name,
            original_filename=csv_path.name,
            original_source="kaggle",
            original_url=request.url,
            file_path=str(dest_path),
            file_size=file_size,
            row_count=len(df),
            column_count=len(df.columns),
            columns=columns
        )
        db.add(dataset)
        db.commit()
        db.refresh(dataset)
        
        return KaggleImportResponse(
            dataset_id=str(dataset.id),
            name=dataset.name,
            original_filename=dataset.original_filename,
            file_size=dataset.file_size,
            row_count=dataset.row_count,
            column_count=dataset.column_count,
            columns=columns
        )


@router.get("/import/kaggle/validate")
async def validate_kaggle_url(url: str):
    """Validate a Kaggle URL and get metadata"""
    try:
        owner, dataset_name = parse_kaggle_url(url)
        return {
            "valid": True,
            "owner": owner,
            "dataset_name": dataset_name,
            "display_name": dataset_name.replace('-', ' ').replace('_', ' ').title()
        }
    except Exception:
        return {
            "valid": False,
            "error": "Invalid Kaggle URL format"
        }
