from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


class ColumnInfo(BaseModel):
    name: str
    dtype: str
    nullable: bool
    unique_count: Optional[int] = None


class DatasetBase(BaseModel):
    name: str


class DatasetCreate(DatasetBase):
    pass


class DatasetResponse(DatasetBase):
    id: UUID
    user_id: UUID
    original_filename: str
    file_size: int
    row_count: int
    column_count: int
    columns: List[ColumnInfo]
    created_at: datetime

    class Config:
        from_attributes = True


class DatasetPreview(BaseModel):
    columns: List[str]
    rows: List[List[Any]]
    total_rows: int


class DatasetUploadResponse(DatasetResponse):
    pass


class CleaningSuggestion(BaseModel):
    id: str
    operation_type: str
    description: str
    column: Optional[str] = None
    affected_rows: Optional[int] = None
    enabled: bool = True
    # Enhanced AI recommendation fields
    column_type: Optional[str] = None
    issue_detected: Optional[str] = None
    recommendation: Optional[str] = None
    strategy: Optional[str] = None
    strategy_options: Optional[List[str]] = None
    priority: Optional[int] = 3  # 1=high, 2=medium, 3=low


class QualityScores(BaseModel):
    """Data quality scores breakdown"""
    overall: float
    completeness: float
    consistency: float
    imbalance: float


class AnalysisResponse(BaseModel):
    dataset_id: UUID
    quality_score: float
    completeness_score: float
    consistency_score: float
    imbalance_score: float
    row_count: int
    column_count: int
    missing_values: Dict[str, int]
    missing_values_percent: Dict[str, float]
    duplicate_rows: int
    duplicate_percentage: float
    outliers: Dict[str, int]
    outliers_percent: Dict[str, float]
    inconsistent_categories: Dict[str, List[str]]
    imbalanced_columns: Dict[str, Dict[str, int]]
    column_types: Dict[str, str]
    summary_stats: Dict[str, Dict[str, Any]]
    categorical_stats: Optional[Dict[str, Dict[str, Any]]] = None


class CleaningRequest(BaseModel):
    operations: List[Dict[str, Any]]
