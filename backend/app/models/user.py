from sqlalchemy import Column, String, Integer, BigInteger, DateTime, Enum, ForeignKey, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.core.database import Base


class SubscriptionTier(str, enum.Enum):
    free = "free"
    pro = "pro"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # Nullable for OAuth users
    name = Column(String(255))
    subscription_tier = Column(Enum(SubscriptionTier), default=SubscriptionTier.free)
    storage_used = Column(BigInteger, default=0)
    operations_used = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # OAuth fields
    oauth_provider = Column(String(50), nullable=True)
    oauth_id = Column(String(255), nullable=True)
    
    # Password reset fields
    reset_token = Column(String(255), nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)
    
    # Email verification
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String(255), nullable=True)

    datasets = relationship("Dataset", back_populates="user")


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    original_filename = Column(String(255))
    file_path = Column(String(500))
    file_size = Column(BigInteger)
    row_count = Column(Integer)
    column_count = Column(Integer)
    columns = Column(JSONB)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="datasets")
    cleaning_operations = relationship("CleaningOperation", back_populates="dataset")


class CleaningOperation(Base):
    __tablename__ = "cleaning_operations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    operation_type = Column(String(100), nullable=False)
    parameters = Column(JSONB)
    created_at = Column(DateTime, default=datetime.utcnow)

    dataset = relationship("Dataset", back_populates="cleaning_operations")
