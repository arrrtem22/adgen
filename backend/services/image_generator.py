import google.generativeai as genai
import os
import base64
from PIL import Image, ImageDraw, ImageFont
import requests
from io import BytesIO
import uuid

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


def generate_images(
    mode: str,
    ad_variations: list[dict],
    product_info: dict,
    competitor_image: str = None
) -> list[dict]:
    """
    Generate images for all ad variations based on mode
    
    Routes to appropriate generation function based on mode
    """
    if mode == "competitor":
        return generate_competitor_based(ad_variations, product_info, competitor_image)
    elif mode == "stock":
        return generate_stock_based(ad_variations, product_info)
    elif mode == "ai":
        return generate_ai_based(ad_variations, product_info)
    else:
        raise ValueError(f"Unknown mode: {mode}")


def generate_competitor_based(ad_variations: list[dict], product_info: dict, competitor_image: str) -> list[dict]:
    """
    Generate ads matching competitor style
    
    TODO: Implement competitor-style matching
    
    What to do:
    1. Decode base64 competitor_image
    2. Use Gemini Vision to analyze competitor ad:
       - model = genai.GenerativeModel('gemini-2.0-flash-exp')
       - Prompt: "Analyze this competitor ad. Extract: color scheme (hex codes), 
                  text placement (top/bottom/center), font style (bold/regular),
                  layout structure. Return as JSON."
       - Pass competitor image to model
    3. Parse style analysis JSON
    4. For each ad_variation:
       - Download product image (if available)
       - Use PIL to create 1080x1080 canvas
       - Apply extracted color scheme
       - Place text in similar position as competitor
       - Add product image if available
       - Save to static/ folder
       - Add image_url to variation dict
    5. Return updated ad_variations list
    
    Tips:
    - Use PIL ImageDraw for text rendering
    - Create gradient overlays with PIL for text readability
    - Save images as: static/ad_{id}.png
    - Return full URL: http://localhost:8000/static/ad_{id}.png
    """
    # STUB: Return variations with placeholder images
    for ad in ad_variations:
        ad["image_url"] = "https://via.placeholder.com/1080x1080/3B82F6/ffffff?text=Competitor+Style"
    return ad_variations


def generate_stock_based(ad_variations: list[dict], product_info: dict) -> list[dict]:
    """
    Generate ads using stock images + text overlay
    
    TODO: Implement stock image + overlay generation
    
    What to do:
    1. For each ad_variation:
       - Search Unsplash API for relevant stock image
         - Use product category/keywords from product_info
         - API: https://api.unsplash.com/search/photos
         - Headers: {'Authorization': f'Client-ID {UNSPLASH_ACCESS_KEY}'}
       - Download the first relevant image
       - Resize to 1080x1080 (crop center if needed)
       - Create text overlay:
         - Add semi-transparent gradient (top or bottom)
         - Add headline text (large, bold)
         - Add copy text (smaller, regular)
         - Use white text with good contrast
       - Save to static/ folder
       - Add image_url to variation
    2. Return updated ad_variations
    
    Tips:
    - PIL Image.open() to load image from URL
    - Use PIL ImageDraw to add rectangles and text
    - Create gradient: draw multiple rectangles with alpha
    - Default fonts: ImageFont.load_default() or download Inter/Roboto
    - Add padding around text for readability
    """
    # STUB: Return variations with placeholder images
    for ad in ad_variations:
        ad["image_url"] = "https://via.placeholder.com/1080x1080/8B5CF6/ffffff?text=Stock+Image"
    return ad_variations


def generate_ai_based(ad_variations: list[dict], product_info: dict) -> list[dict]:
    """
    Generate ads using Gemini image generation + text overlay
    
    TODO: Implement AI image generation
    
    What to do:
    1. For each ad_variation:
       - Build image generation prompt:
         - "Professional product photography for {product_title}"
         - "Style: {angle} advertising"
         - "Clean background, high quality, commercial photography"
         - "1:1 square format, product-focused"
       - Use Gemini image generation:
         - model = genai.GenerativeModel('gemini-3.1-flash-image-preview')
         - response = model.generate_content(prompt)
         - Extract image data: response.parts[0].inline_data.data
       - Save generated image
       - Add text overlay (same as stock mode):
         - Headline + copy on gradient background
       - Save final image to static/
       - Add image_url to variation
    2. Return updated ad_variations
    
    Tips:
    - Keep prompts simple and focused on product
    - Generated images work better with minimal text in prompt
    - Add text overlay separately (AI struggles with text)
    - Handle API failures gracefully (fallback to placeholder)
    """
    # STUB: Return variations with placeholder images
    for ad in ad_variations:
        ad["image_url"] = "https://via.placeholder.com/1080x1080/10B981/ffffff?text=AI+Generated"
    return ad_variations


def add_text_overlay(image: Image.Image, headline: str, copy: str, style: str = "bottom") -> Image.Image:
    """
    Add text overlay to an image
    
    TODO: Implement text overlay function
    
    What to do:
    1. Create ImageDraw object
    2. Based on style ("top", "bottom", "center"):
       - Draw gradient overlay (30-40% of image height)
       - Use semi-transparent black/dark color
    3. Add headline text:
       - Large font size (60-80px if available)
       - Bold weight
       - Centered horizontally
       - Positioned in overlay area
    4. Add copy text:
       - Smaller font (30-40px)
       - Regular weight
       - Centered horizontally
       - Below headline with padding
    5. Return modified image
    
    Tips:
    - Use ImageFont.truetype() if you have font files
    - Otherwise use ImageFont.load_default()
    - Calculate text bounding box for centering: draw.textbbox()
    - Add padding (40-60px) from edges
    - White text works best with dark overlays
    """
    # STUB: Return image unchanged
    return image
