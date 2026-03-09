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


class FoundationDoc(BaseModel):
    name: str
    status: str = "pending"
    content: str = ""
    desc: str = ""
    type: str = "doc"


class FoundationData(BaseModel):
    research: FoundationDoc
    avatar: FoundationDoc
    beliefs: FoundationDoc
    positioning: FoundationDoc
    context: FoundationDoc
    anglesDoc: FoundationDoc


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


class BatchGenerateRequest(BaseModel):
    project: Project
    batch_config: BatchConfig
    mode: str = "stock"
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
    copy_text: str = Field(..., alias="copy")  # Renamed to avoid shadowing BaseModel.copy()
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
    
    class Config:
        populate_by_name = True


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


class VariantForImageGen(BaseModel):
    """Minimal variant data needed for image generation."""
    id: str
    angle: str
    mode: Literal["A", "B", "C"]
    format: str
    hook: str
    headline: str
    subhead: Optional[str] = ""
    bullets: list[str] = []
    cta: Optional[str] = ""
    imgNote: Optional[str] = ""
    bg: Optional[str] = "bg-dark"
    status: Literal["pending", "approved", "skipped"] = "pending"
    imageB64: Optional[str] = None


class ImageGenerationRequest(BaseModel):
    """Request model for generating images for approved variants."""
    variants: list[VariantForImageGen]
    product_info: ProductInfo
    mode: Literal["competitor", "stock", "ai"] = "ai"
    competitor_image: Optional[str] = None
    foundation: Optional[FoundationData] = None


class ImageGenerationResponse(BaseModel):
    """Response model with generated images."""
    variants: list[VariantForImageGen]
    generated_count: int
    failed_count: int
