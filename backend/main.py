from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import uuid
import base64

# Load .env for local development (Vercel uses env vars from dashboard)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from models.schemas import (
    GenerateRequest, GenerateResponse, AdVariation, MockMetrics,
    ScrapeRequest, ScrapeResponse, HealthResponse,
    Project, BatchConfig, FoundationData,
    ImageGenerationRequest, ImageGenerationResponse,
    BatchGenerateRequest
)
from services.scraper import scrape_product
from services.ad_generator import generate_ad_copy_variations
from services.image_generator import generate_images
from services.metrics import generate_mock_metrics, generate_metrics_for_batch, simulate_ab_test

app = FastAPI(
    title="AI Ad Creative Generator API",
    description="Backend for generating self-evolving Meta ad creatives",
    version="1.0.0"
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],  # Vite default ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files (generated images) - skip on Vercel (read-only filesystem)
STATIC_DIR = os.getenv("STATIC_DIR", "static")
try:
    os.makedirs(STATIC_DIR, exist_ok=True)
    os.makedirs(f"{STATIC_DIR}/uploads", exist_ok=True)
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
except OSError:
    # Vercel has read-only filesystem, skip static file serving
    print("Warning: Cannot create static directories (read-only filesystem). Using base64 images only.")


@app.get("/", response_model=HealthResponse)
def read_root():
    """Health check endpoint."""
    return {"status": "ok", "version": "1.0.0"}


@app.get("/health", response_model=HealthResponse)
def health_check():
    """Detailed health check."""
    gemini_key = bool(os.getenv("GEMINI_API_KEY"))
    unsplash_key = bool(os.getenv("UNSPLASH_ACCESS_KEY"))
    
    return {
        "status": "ok",
        "version": "1.0.0",
        "services": {
            "gemini_configured": gemini_key,
            "unsplash_configured": unsplash_key,
        }
    }


@app.post("/scrape", response_model=ScrapeResponse)
async def scrape_url(request: ScrapeRequest):
    """
    Scrape product information from a URL.
    """
    try:
        product_info = scrape_product(str(request.url))
        return ScrapeResponse(**product_info)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")


@app.post("/generate", response_model=GenerateResponse)
async def generate_ads(request: GenerateRequest):
    """
    Main endpoint to generate ad variations.
    
    Flow:
    1. Scrape product information from URL
    2. Generate ad copy variations (3-4 variations)
    3. Generate images based on mode (competitor/stock/ai)
    4. Add mock metrics to each variation
    5. Return complete ad variations
    """
    try:
        # Get batch config or use defaults
        batch_config = request.batch_config
        count = batch_config.count if batch_config else 4
        
        # Step 1: Scrape product info
        product_info = scrape_product(str(request.product_url))
        
        # Override with project product info if provided
        if request.project:
            product_info.update({
                "name": request.project.brand.product.name,
                "promise": request.project.brand.product.promise,
                "offer": request.project.brand.product.offer,
                "visualDesc": request.project.brand.product.visualDesc,
            })
        
        # Step 2: Generate ad copy variations
        ad_variations = generate_ad_copy_variations(
            product_info=product_info,
            iteration=request.iteration,
            previous_winners=request.previous_winners,
            count=count
        )
        
        # Step 3: Generate images for each variation
        ads_with_images = generate_images(
            mode=request.mode,
            ad_variations=ad_variations,
            product_info=product_info,
            competitor_image=request.competitor_image
        )
        
        # Step 4: Add mock metrics
        ads_with_metrics = generate_metrics_for_batch(
            ads_with_images,
            iteration=request.iteration,
            previous_winners=request.previous_winners
        )
        
        # Generate batch ID
        batch_id = f"batch_{uuid.uuid4().hex[:12]}"
        
        return GenerateResponse(
            ads=ads_with_metrics,
            batch_id=batch_id,
            project_info={
                "product_name": product_info.get("title"),
                "mode": request.mode,
                "iteration": request.iteration,
            }
        )
        
    except Exception as e:
        import traceback
        print(f"Error in generate_ads: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate/batch")
async def generate_batch(request: BatchGenerateRequest):
    """
    Generate a full batch of ad variations based on frontend state.
    
    This endpoint matches the frontend's batch generation flow.
    """
    try:
        project = request.project
        batch_config = request.batch_config
        mode = request.mode
        iteration = request.iteration
        previous_winners = request.previous_winners
        # Build product info from project
        product_info = {
            "title": project.brand.product.name,
            "url": str(project.brand.product.url),
            "description": project.brand.product.promise,
            "promise": project.brand.product.promise,
            "offer": project.brand.product.offer,
            "visualDesc": project.brand.product.visualDesc,
            "price": "",  # Could be extracted from offer
        }
        
        # Generate variations
        variations = generate_ad_copy_variations(
            product_info=product_info,
            iteration=iteration,
            previous_winners=previous_winners,
            count=batch_config.count
        )
        
        # Assign modes based on ratio
        modes = []
        total = batch_config.count
        a_count = int(total * batch_config.modeRatio.get("A", 50) / 100)
        b_count = int(total * batch_config.modeRatio.get("B", 30) / 100)
        
        for i in range(total):
            if i < a_count:
                modes.append("A")
            elif i < a_count + b_count:
                modes.append("B")
            else:
                modes.append("C")
        
        # Update variations with assigned modes
        for i, var in enumerate(variations):
            var["mode"] = modes[i]
            # Filter by selected angles if specified
            if batch_config.angles:
                var["angle"] = batch_config.angles[i % len(batch_config.angles)]
        
        # Generate images
        variations = generate_images(
            mode=mode,
            ad_variations=variations,
            product_info=product_info,
            competitor_image=None
        )
        
        # Add metrics
        variations = generate_metrics_for_batch(
            variations,
            iteration=iteration,
            previous_winners=previous_winners
        )
        
        # Create batch response
        batch_id = f"batch_{uuid.uuid4().hex[:12]}"
        
        return {
            "batch": {
                "id": batch_id,
                "num": 1,  # Frontend will update this
                "date": "2026-03-07",
                "config": batch_config.dict(),
                "variants": variations,
                "status": "reviewing",
            },
            "variations": variations,
        }
        
    except Exception as e:
        import traceback
        print(f"Error in generate_batch: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload/competitor")
async def upload_competitor(image: UploadFile = File(...)):
    """
    Upload a competitor image for analysis.
    Returns base64 encoded image for use in generation.
    """
    try:
        contents = await image.read()
        
        # Save to static
        filename = f"uploads/comp_{uuid.uuid4().hex[:12]}_{image.filename}"
        filepath = f"static/{filename}"
        
        with open(filepath, "wb") as f:
            f.write(contents)
        
        # Return base64
        b64 = base64.b64encode(contents).decode()
        
        return {
            "filename": filename,
            "url": f"/static/{filename}",
            "base64": b64,
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.post("/metrics/simulate")
async def simulate_metrics(variations: list[dict], days: int = 7):
    """
    Simulate A/B test metrics over time.
    """
    try:
        results = simulate_ab_test(variations, days)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/static/{path:path}")
async def serve_static(path: str):
    """Serve static files."""
    file_path = f"static/{path}"
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="File not found")


@app.post("/generate/images", response_model=ImageGenerationResponse)
async def generate_images_for_variants(request: ImageGenerationRequest):
    """
    Generate images for approved ad variants using Gemini image model.
    """
    try:
        variants = request.variants
        product_info = request.product_info
        mode = request.mode
        competitor_image = request.competitor_image
        foundation = request.foundation
        
        ad_variations = []
        for v in variants:
            var_dict = {
                "id": v.id,
                "headline": v.headline,
                "subhead": v.subhead or "",
                "cta": v.cta or "Learn More →",
                "angle": v.angle,
                "mode": v.mode,
                "hook": v.hook or v.headline,
                "imgNote": v.imgNote or "",
            }
            ad_variations.append(var_dict)
        
        foundation_data = None
        if foundation:
            foundation_data = {
                "research": foundation.research.content if foundation.research.status == "done" else "",
                "avatar": foundation.avatar.content if foundation.avatar.status == "done" else "",
                "beliefs": foundation.beliefs.content if foundation.beliefs.status == "done" else "",
                "positioning": foundation.positioning.content if foundation.positioning.status == "done" else "",
                "context": foundation.context.content if foundation.context.status == "done" else "",
            }
        
        ads_with_images = generate_images(
            mode=mode,
            ad_variations=ad_variations,
            product_info=product_info.dict() if product_info else {},
            competitor_image=competitor_image,
            foundation_data=foundation_data
        )
        
        generated_count = 0
        failed_count = 0
        updated_variants = []
        
        for i, var in enumerate(variants):
            if i < len(ads_with_images):
                image_url = ads_with_images[i].get("image_url")
                if image_url:
                    updated_var = var.copy(update={"imageB64": image_url})
                    updated_variants.append(updated_var)
                    generated_count += 1
                else:
                    updated_variants.append(var)
                    failed_count += 1
            else:
                updated_variants.append(var)
                failed_count += 1
        
        return ImageGenerationResponse(
            variants=updated_variants,
            generated_count=generated_count,
            failed_count=failed_count
        )
    except Exception as e:
        import traceback
        print(f"Error in generate_images_for_variants: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# Foundation endpoints
class FoundationDocResponse(BaseModel):
    name: str
    status: str
    content: str
    desc: str
    type: str


class FoundationDataResponse(BaseModel):
    research: FoundationDocResponse
    avatar: FoundationDocResponse
    beliefs: FoundationDocResponse
    positioning: FoundationDocResponse
    context: FoundationDocResponse
    angles: FoundationDocResponse


class FoundationGenerationRequest(BaseModel):
    brand: dict
    compliance: dict
    comp_intel: str = ""


class FoundationGenerationResponse(BaseModel):
    foundation: FoundationDataResponse
    angles: list[dict]


@app.post("/foundation/generate", response_model=FoundationGenerationResponse)
async def generate_foundation(request: FoundationGenerationRequest):
    """
    Generate foundation documents based on brand configuration.
    Uses the AI provider (Claude or Gemini) to generate research docs.
    """
    try:
        from services.ai_provider import get_provider
        
        provider = get_provider()
        if not provider:
            raise HTTPException(status_code=500, detail="No AI provider available. Set ANTHROPIC_API_KEY or GEMINI_API_KEY.")
        
        brand = request.brand
        compliance = request.compliance
        
        # Generate research document
        research_prompt = f"""Generate a market research document for:
Brand: {brand.get('name', 'Unknown')}
Category: {brand.get('category', 'General')}
Product: {brand.get('product', {}).get('name', 'Product')}
Promise: {brand.get('product', {}).get('promise', '')}
Voice: {brand.get('voice', 'Professional')}

Include: market landscape, product facts, customer demographics, purchase triggers, competitive landscape, market gaps.
Write in clear, factual prose."""

        research_content = provider.generate_text(research_prompt, temperature=0.7, max_tokens=2000)
        
        # Generate avatar document
        avatar_prompt = f"""Generate a detailed customer avatar for:
Brand: {brand.get('name', 'Unknown')}
Product: {brand.get('product', {}).get('name', 'Product')}
Promise: {brand.get('product', {}).get('promise', '')}

Include: who they are, a day in their life, the felt problem, what they've tried, emotional states, internal narrative, dream outcome, language they use."""

        avatar_content = provider.generate_text(avatar_prompt, temperature=0.7, max_tokens=2000)
        
        # Generate beliefs document
        beliefs_prompt = f"""Generate a belief shift map for:
Product: {brand.get('product', {}).get('name', 'Product')}
Promise: {brand.get('product', {}).get('promise', '')}

Include: core belief shift, blocking beliefs, triggering beliefs, best proof types, objections to pre-empt."""

        beliefs_content = provider.generate_text(beliefs_prompt, temperature=0.7, max_tokens=2000)
        
        # Generate positioning document
        positioning_prompt = f"""Generate a positioning document for:
Brand: {brand.get('name', 'Unknown')}
Product: {brand.get('product', {}).get('name', 'Product')}
Promise: {brand.get('product', {}).get('promise', '')}
Offer: {brand.get('product', {}).get('offer', '')}

Include: core positioning statement, key differentiators, value proposition, positioning angles."""

        positioning_content = provider.generate_text(positioning_prompt, temperature=0.7, max_tokens=2000)
        
        # Generate context document
        context_prompt = f"""Generate a compressed ICP summary (context.json) for:
Brand: {brand.get('name', 'Unknown')}
Product: {brand.get('product', {}).get('name', 'Product')}
Promise: {brand.get('product', {}).get('promise', '')}

Provide a JSON-like summary of: ideal customer profile, key pain points, desired outcomes, and messaging themes."""

        context_content = provider.generate_text(context_prompt, temperature=0.7, max_tokens=1500)
        
        # Generate angles document
        angles_prompt = f"""Generate ad angles for:
Brand: {brand.get('name', 'Unknown')}
Product: {brand.get('product', {}).get('name', 'Product')}
Promise: {brand.get('product', {}).get('promise', '')}

Provide 6-8 distinct advertising angles with: angle name, hook, proof points, and emotional trigger."""

        angles_content = provider.generate_text(angles_prompt, temperature=0.8, max_tokens=2000)
        
        # Parse angles for response
        angles = [
            {"name": "Problem-Solution", "perf_tag": "proven"},
            {"name": "Social Proof", "perf_tag": "winner"},
            {"name": "Transformation", "perf_tag": "proven"},
            {"name": "FOMO/Urgency", "perf_tag": "comp"},
            {"name": "Objection Busting", "perf_tag": "untested"},
            {"name": "Comparison", "perf_tag": "comp"},
        ]
        
        foundation = FoundationDataResponse(
            research=FoundationDocResponse(name="research.md", status="done", content=research_content, desc="market landscape, product facts, ICP demographics", type="doc"),
            avatar=FoundationDocResponse(name="avatar.md", status="done", content=avatar_content, desc="ICP profile with emotional states per angle", type="doc"),
            beliefs=FoundationDocResponse(name="beliefs.md", status="done", content=beliefs_content, desc="belief shift map", type="doc"),
            positioning=FoundationDocResponse(name="positioning.md", status="done", content=positioning_content, desc="core positioning + which angles it suits", type="doc"),
            context=FoundationDocResponse(name="context.json", status="done", content=context_content, desc="compressed ICP summary", type="key"),
            angles=FoundationDocResponse(name="angles.json", status="done", content=angles_content, desc="angle defs + hooks + proof points", type="angle"),
        )
        
        return FoundationGenerationResponse(
            foundation=foundation,
            angles=angles
        )
        
    except Exception as e:
        import traceback
        print(f"Error in generate_foundation: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/foundation/check-completion")
async def check_foundation_completion(project: dict):
    """
    Check completion status of all project hub steps.
    """
    try:
        completion = {
            'brandConfig': False,
            'foundation': False,
            'refs': False,
            'intel': False,
        }
        
        brand = project.get('brand', {})
        completion['brandConfig'] = bool(
            brand.get('name') and 
            brand.get('voice') and 
            brand.get('product', {}).get('name') and 
            brand.get('product', {}).get('promise')
        )
        
        foundation = project.get('foundation', {})
        if foundation:
            docs = [
                foundation.get('research', {}),
                foundation.get('avatar', {}),
                foundation.get('beliefs', {}),
                foundation.get('positioning', {}),
                foundation.get('context', {}),
                foundation.get('angles', {}),
            ]
            completion['foundation'] = all(doc.get('status') == 'done' for doc in docs)
        
        completion['refs'] = len(project.get('angles', [])) > 0
        completion['intel'] = True
        
        all_complete = all(completion.values())
        
        return {
            'completion': completion,
            'allComplete': all_complete,
            'missing': [k for k, v in completion.items() if not v],
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
