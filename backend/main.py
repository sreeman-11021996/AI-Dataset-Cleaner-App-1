from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, datasets, analysis, cleaning, subscription, api, kaggle, export
from app.core.database import engine
from app.models import base

base.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="DatasetCleaner AI API",
    description="Backend API for DatasetCleaner AI - Automated data cleaning for ML",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(datasets.router, prefix="/api/datasets", tags=["Datasets"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])
app.include_router(cleaning.router, prefix="/api/cleaning", tags=["Cleaning"])
app.include_router(subscription.router, prefix="/api/subscription", tags=["Subscription"])
app.include_router(api.router, prefix="/api", tags=["Developer API"])
app.include_router(kaggle.router, prefix="/api/datasets", tags=["Kaggle Import"])
app.include_router(export.router, prefix="/api/datasets", tags=["ML Pipeline Export"])


@app.get("/")
async def root():
    return {"message": "DatasetCleaner AI API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
