from pydantic import BaseModel, Field
from typing import Optional

class WaybackSearchResponse(BaseModel):
    timestamp: str
    original: str
    statuscode: str
    mime: str
    digest: str

class WaybackAvailabilityResponse(BaseModel):
    url: str
    available: bool
    snapshot_url: Optional[str] = None
    timestamp: Optional[str] = None
