from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
import os
import uuid
import base64

from models.schemas import (
    GenerateRequest, GenerateResponse, AdVariation, MockMetrics,
    ScrapeRequest, ScrapeResponse, HealthResponse,
    Project, BatchConfig
)
from services.scraper import scrape_product
from services.ad_generator import generate_ad_copy_variations
from services.image_generator import generate_images
from services.metrics import generate_mock_metrics, generate_metrics_for_batch, simulate_ab_test

load_dotenv()

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

# Serve static files (generated images)
os.makedirs("static", exist_ok=True)
os.makedirs("static/uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


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
async def generate_batch(
    project: Project,
    batch_config: BatchConfig,
    mode: str = "stock",
    iteration: bool = False,
    previous_winners: list[str] = None
):
    """
    Generate a full batch of ad variations based on frontend state.
    
    This endpoint matches the frontend's batch generation flow.
    """
    try:
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
