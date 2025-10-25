from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class LandmarkPoint(BaseModel):
    x: float
    y: float
    z: float

class Frame(BaseModel):
    timestamp: int
    landmarks: List[LandmarkPoint]
    handedness: Optional[str] = "Right"
    confidence: Optional[float] = 0.0

class GestureCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    action: str = Field(..., min_length=1, max_length=50)
    app_context: Optional[str] = "GLOBAL"
    frames: List[Frame]

class GestureResponse(BaseModel):
    id: int
    user_id: int
    name: str
    action: str
    app_context: str
    accuracy_score: Optional[float]
    created_at: datetime
    updated_at: Optional[datetime] = None  # Make optional until column is added

    class Config:
        from_attributes = True
