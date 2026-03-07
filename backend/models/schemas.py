from pydantic import BaseModel, HttpUrl
from typing import Optional, Literal


class GenerateRequest(BaseModel):
    mode: Literal["competitor", "stock", "ai"]
    product_url: HttpUrl
    competitor_image: Optional[str] = None  # base64 encoded
    iteration: bool = False
    previous_winners: Optional[list[str]] = None


class MockMetrics(BaseModel):
    ctr: float
    impressions: int
    clicks: int


class AdVariation(BaseModel):
    id: str
    angle: str
    persona: str
    headline: str
    copy: str
    image_url: str
    mock_metrics: MockMetrics


class GenerateResponse(BaseModel):
    ads: list[AdVariation]
