from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import os

from models.schemas import GenerateRequest, GenerateResponse
from services.scraper import scrape_product
from services.ad_generator import generate_ad_copy_variations
from services.image_generator import generate_images
from services.metrics import generate_mock_metrics

load_dotenv()

app = FastAPI(title="AI Ad Creative Generator API")

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update with frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files (generated images)
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def read_root():
    return {"message": "AI Ad Creative Generator API"}


@app.post("/generate", response_model=GenerateResponse)
async def generate_ads(request: GenerateRequest):
    """
    Main endpoint to generate ad variations
    
    Flow:
    1. Scrape product information from URL
    2. Generate ad copy variations (3-4 variations)
    3. Generate images based on mode (competitor/stock/ai)
    4. Add mock metrics to each variation
    5. Return complete ad variations
    """
    try:
        # Step 1: Scrape product info
        product_info = scrape_product(str(request.product_url))
        
        # Step 2: Generate ad copy variations
        ad_variations = generate_ad_copy_variations(
            product_info=product_info,
            iteration=request.iteration,
            previous_winners=request.previous_winners
        )
        
        # Step 3: Generate images for each variation
        ads_with_images = generate_images(
            mode=request.mode,
            ad_variations=ad_variations,
            product_info=product_info,
            competitor_image=request.competitor_image
        )
        
        # Step 4: Add mock metrics
        for ad in ads_with_images:
            ad["mock_metrics"] = generate_mock_metrics(
                iteration=request.iteration,
                is_winner=False  # You can enhance this later
            )
        
        return GenerateResponse(ads=ads_with_images)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
