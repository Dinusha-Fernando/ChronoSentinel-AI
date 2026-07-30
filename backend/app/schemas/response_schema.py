from pydantic import BaseModel, Field

class SystemStatusResponse(BaseModel):
    status: str
    postgres: str
    redis: str
    version: str = "1.0.0"

class BulkAnalysisRequest(BaseModel):
    domains: list[str] = Field(
        ..., 
        min_length=1, 
        max_length=100, 
        description="List of domain names to analyze in bulk (1 to 100 domains max per request)"
    )

class BulkAnalysisResponse(BaseModel):
    task_id: str
    message: str
