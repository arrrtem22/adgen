from pydantic import BaseModel, HttpUrl, Field
from typing import Optional, Literal


class ProductInfo(BaseModel):
    name: str
    url: str
    promise: str
    offer: str
    visualDesc: str
    price: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None


class BrandConfig(BaseModel):
    name: str
    category: str
    voice: str
    palette: list[str]
    product: ProductInfo


class Angle(BaseModel):
    name: str
    perf_tag: Literal['winner', 'proven', 'comp', 'untested']


class Compliance(BaseModel):
    level: str
    forbidden_claims: list[str]
    disclaimer: str


class CompletionStatus(BaseModel):
    brandConfig: bool = False
    foundation: bool = False
    refs: bool = False
    intel: bool = False


class Project(BaseModel):
    id: str
    name: str
    status: str
    brand: BrandConfig
    compliance: Compliance
    angles: list[Angle]
    foundation: Optional[FoundationData] = None
    completion: Optional[CompletionStatus] = None


class BatchConfig(BaseModel):
    count: int = Field(ge=1, le=20)
    focus: str
    angles: list[str]
    dryRun: bool = True
    modeRatio: dict[str, int] = {"A": 50, "B": 30, "C": 20}


class GenerateRequest(BaseModel):
    mode: Literal["competitor", "stock", "ai"]
    product_url: HttpUrl
    competitor_image: Optional[str] = None  # base64 encoded
    iteration: bool = False
    previous_winners: Optional[list[str]] = None
    project: Optional[Project] = None
    batch_config: Optional[BatchConfig] = None


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
    # Extended fields for frontend compatibility
    mode: Optional[Literal["A", "B", "C"]] = None
    format: Optional[str] = None
    hook: Optional[str] = None
    subhead: Optional[str] = None
    bullets: Optional[list[str]] = None
    cta: Optional[str] = None
    imgNote: Optional[str] = None
    bg: Optional[str] = None
    status: Optional[Literal["pending", "approved", "skipped"]] = "pending"
    imageB64: Optional[str] = None


class GenerateResponse(BaseModel):
    ads: list[AdVariation]
    batch_id: Optional[str] = None
    project_info: Optional[dict] = None


class ScrapeRequest(BaseModel):
    url: HttpUrl


class ScrapeResponse(BaseModel):
    title: str
    description: str
    price: Optional[str] = None
    image_url: Optional[str] = None
    promise: Optional[str] = None
    offer: Optional[str] = None
    visualDesc: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"


class FoundationDoc(BaseModel):
    name: str
    status: str = "pending"  # pending, generating, done, error
    content: str = ""
    desc: str = ""
    type: str = "doc"  # doc, json, key, angle


class FoundationData(BaseModel):
    research: FoundationDoc
    avatar: FoundationDoc
    beliefs: FoundationDoc
    positioning: FoundationDoc
    context: FoundationDoc
    anglesDoc: FoundationDoc


class FoundationGenerationRequest(BaseModel):
    brand: BrandConfig
    compliance: Compliance
    comp_intel: str = ""


class FoundationGenerationResponse(BaseModel):
    foundation: FoundationData
    angles: list[Angle]
