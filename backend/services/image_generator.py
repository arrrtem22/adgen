import os
import base64
import json
import re
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import requests
from io import BytesIO
import uuid
from typing import Optional


def strip_emojis(text: str) -> str:
    """Remove emojis from text as they don't render properly on images."""
    if not text:
        return text
    # Remove common arrow emojis and symbols that don't render
    text = text.replace('→', '>').replace('←', '<').replace('↑', '^').replace('↓', 'v')
    text = text.replace('✓', '✔').replace('✕', 'x').replace('✗', 'x')
    # Remove emoji using regex pattern
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"  # emoticons
        "\U0001F300-\U0001F5FF"  # symbols & pictographs
        "\U0001F680-\U0001F6FF"  # transport & map symbols
        "\U0001F1E0-\U0001F1FF"  # flags
        "\U00002702-\U000027B0"
        "\U000024C2-\U0001F251"
        "]+", 
        flags=re.UNICODE
    )
    return emoji_pattern.sub(r'', text).strip()

# Configure Gemini - use new SDK
try:
    from google import genai
    from google.genai import types
    USE_NEW_SDK = True
except ImportError:
    import google.generativeai as genai
    USE_NEW_SDK = False

api_key = os.getenv("GEMINI_API_KEY")
unsplash_key = os.getenv("UNSPLASH_ACCESS_KEY")

# Initialize client
client = None
if api_key:
    if USE_NEW_SDK:
        client = genai.Client(api_key=api_key)
    else:
        genai.configure(api_key=api_key)


def get_image_model():
    """Get the Gemini image generation model."""
    if USE_NEW_SDK and client:
        return client
    return genai.GenerativeModel('gemini-3.1-flash-image-preview')


def get_vision_model():
    """Get the Gemini vision model for analysis."""
    if USE_NEW_SDK and client:
        return client
    return genai.GenerativeModel('gemini-3.1-flash-image-preview')


def ensure_static_dir():
    """Ensure static directory exists."""
    os.makedirs("static", exist_ok=True)


def download_image(url: str) -> Optional[Image.Image]:
    """Download image from URL and return PIL Image."""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        return Image.open(BytesIO(response.content))
    except Exception as e:
        print(f"Error downloading image: {e}")
        return None


def create_gradient_overlay(image: Image.Image, position: str = "bottom", opacity: float = 0.7) -> Image.Image:
    """Create a gradient overlay for text readability."""
    width, height = image.size
    overlay = Image.new('RGBA', image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    
    gradient_height = int(height * 0.4)
    
    if position == "bottom":
        for i in range(gradient_height):
            alpha = int(opacity * 255 * (i / gradient_height))
            y = height - gradient_height + i
            draw.line([(0, y), (width, y)], fill=(0, 0, 0, alpha))
    elif position == "top":
        for i in range(gradient_height):
            alpha = int(opacity * 255 * ((gradient_height - i) / gradient_height))
            draw.line([(0, i), (width, i)], fill=(0, 0, 0, alpha))
    
    return Image.alpha_composite(image.convert('RGBA'), overlay)


def add_text_overlay(
    image: Image.Image,
    headline: str,
    subhead: str = "",
    cta: str = "",
    style: str = "bottom"
) -> Image.Image:
    """Add text overlay to an image."""
    # Convert to RGBA for compositing
    if image.mode != 'RGBA':
        image = image.convert('RGBA')
    
    width, height = image.size
    
    # Create overlay
    img_with_overlay = create_gradient_overlay(image, style, 0.6)
    
    # Create drawing context
    draw = ImageDraw.Draw(img_with_overlay)
    
    # Try to load fonts, fallback to default
    try:
        # Try system fonts
        font_paths = [
            "/System/Library/Fonts/Helvetica.ttc",  # macOS
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",  # Linux
            "C:/Windows/Fonts/arial.ttf",  # Windows
        ]
        
        headline_font = None
        subhead_font = None
        cta_font = None
        
        for font_path in font_paths:
            if os.path.exists(font_path):
                headline_font = ImageFont.truetype(font_path, int(height * 0.06))
                subhead_font = ImageFont.truetype(font_path, int(height * 0.035))
                cta_font = ImageFont.truetype(font_path, int(height * 0.03))
                break
        
        if not headline_font:
            raise IOError("No system font found")
            
    except:
        headline_font = ImageFont.load_default()
        subhead_font = ImageFont.load_default()
        cta_font = ImageFont.load_default()
    
    # Calculate text positions
    margin = int(width * 0.08)
    
    # Draw headline
    if headline:
        # Wrap text if too long
        max_width = width - (margin * 2)
        words = headline.split()
        lines = []
        current_line = []
        
        for word in words:
            test_line = ' '.join(current_line + [word])
            bbox = draw.textbbox((0, 0), test_line, font=headline_font)
            if bbox[2] - bbox[0] <= max_width:
                current_line.append(word)
            else:
                if current_line:
                    lines.append(' '.join(current_line))
                current_line = [word]
        if current_line:
            lines.append(' '.join(current_line))
        
        # Draw lines
        if style == "bottom":
            y_start = height - int(height * 0.35)
        else:
            y_start = int(height * 0.15)
        
        line_height = int(height * 0.075)
        for i, line in enumerate(lines[:3]):  # Max 3 lines
            bbox = draw.textbbox((0, 0), line, font=headline_font)
            text_width = bbox[2] - bbox[0]
            x = (width - text_width) // 2
            y = y_start + (i * line_height)
            
            # Draw text shadow
            draw.text((x+2, y+2), line, font=headline_font, fill=(0, 0, 0, 180))
            # Draw text
            draw.text((x, y), line, font=headline_font, fill=(255, 255, 255, 255))
    
    # Draw subhead
    if subhead:
        y_subhead = y_start + (len(lines) * line_height) + int(height * 0.02)
        bbox = draw.textbbox((0, 0), subhead, font=subhead_font)
        text_width = bbox[2] - bbox[0]
        x = (width - text_width) // 2
        draw.text((x+1, y_subhead+1), subhead, font=subhead_font, fill=(0, 0, 0, 150))
        draw.text((x, y_subhead), subhead, font=subhead_font, fill=(255, 255, 255, 230))
    
    # Draw CTA button (strip emojis as they don't render properly)
    cta = strip_emojis(cta) if cta else cta
    if cta:
        cta_y = height - int(height * 0.12)
        bbox = draw.textbbox((0, 0), cta, font=cta_font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        # Button background
        padding_x = int(width * 0.05)
        padding_y = int(height * 0.015)
        button_width = text_width + (padding_x * 2)
        button_height = text_height + (padding_y * 2)
        button_x = (width - button_width) // 2
        button_y = cta_y - padding_y
        
        # Draw button
        draw.rounded_rectangle(
            [button_x, button_y, button_x + button_width, button_y + button_height],
            radius=int(height * 0.02),
            fill=(255, 255, 255, 230)
        )
        
        # Draw CTA text
        text_x = button_x + padding_x
        text_y = button_y + padding_y - int(text_height * 0.1)
        draw.text((text_x, text_y), cta, font=cta_font, fill=(0, 0, 0, 255))
    
    return img_with_overlay.convert('RGB')


def generate_images(
    mode: str,
    ad_variations: list[dict],
    product_info: dict,
    competitor_image: str = None,
    foundation_data: dict = None
) -> list[dict]:
    """
    Generate images for all ad variations based on mode.
    """
    ensure_static_dir()
    
    # Pass foundation data to generation functions
    kwargs = {}
    if foundation_data:
        kwargs['foundation_data'] = foundation_data
    
    if mode == "competitor":
        return generate_competitor_based(ad_variations, product_info, competitor_image, **kwargs)
    elif mode == "stock":
        return generate_stock_based(ad_variations, product_info, **kwargs)
    elif mode == "ai":
        return generate_ai_based(ad_variations, product_info)
    else:
        raise ValueError(f"Unknown mode: {mode}")


def analyze_competitor_image(image_b64: str) -> dict:
    """Analyze competitor image to extract style."""
    if not api_key:
        return {
            "color_scheme": ["#1a1a1a", "#ffffff", "#c8f060"],
            "text_position": "bottom",
            "font_style": "bold",
            "layout": "centered"
        }
    
    try:
        model = get_vision_model()
        
        # Decode base64 image
        image_data = base64.b64decode(image_b64)
        image = Image.open(BytesIO(image_data))
        
        prompt = """Analyze this advertisement image. Extract the following as JSON:
{
  "color_scheme": [primary color hex, secondary color hex, accent color hex],
  "text_position": "top" | "bottom" | "center",
  "font_style": "bold" | "regular" | "light",
  "layout": "centered" | "left" | "right",
  "mood": "professional" | "casual" | "luxury" | "playful"
}

Return ONLY valid JSON."""
        
        response = model.generate_content([prompt, image])
        
        # Parse JSON from response
        text = response.text
        if '```json' in text:
            text = text.split('```json')[1].split('```')[0]
        elif '```' in text:
            text = text.split('```')[1].split('```')[0]
        
        return json.loads(text.strip())
        
    except Exception as e:
        print(f"Error analyzing competitor image: {e}")
        return {
            "color_scheme": ["#1a1a1a", "#ffffff", "#c8f060"],
            "text_position": "bottom",
            "font_style": "bold",
            "layout": "centered"
        }


def generate_competitor_based(
    ad_variations: list[dict],
    product_info: dict,
    competitor_image: str
) -> list[dict]:
    """Generate ads matching competitor style."""
    
    # Analyze competitor image if provided
    style = {"text_position": "bottom"}
    if competitor_image:
        style = analyze_competitor_image(competitor_image)
    
    for ad in ad_variations:
        try:
            # Create base image
            width, height = 1080, 1080
            
            # Use colors from style analysis or defaults
            colors = style.get("color_scheme", ["#1a1a1a", "#2a2a2a", "#c8f060"])
            
            # Create gradient background
            image = Image.new('RGB', (width, height), colors[0])
            draw = ImageDraw.Draw(image)
            
            # Add some visual interest with gradient-like effect
            for y in range(height):
                ratio = y / height
                r = int(int(colors[0][1:3], 16) * (1 - ratio) + int(colors[1][1:3], 16) * ratio)
                g = int(int(colors[0][3:5], 16) * (1 - ratio) + int(colors[1][3:5], 16) * ratio)
                b = int(int(colors[0][5:7], 16) * (1 - ratio) + int(colors[1][5:7], 16) * ratio)
                draw.line([(0, y), (width, y)], fill=(r, g, b))
            
            # Add text overlay
            image = add_text_overlay(
                image,
                ad.get("headline", ""),
                ad.get("subhead", ""),
                ad.get("cta", "Learn More →"),
                style.get("text_position", "bottom")
            )
            
            # Save image
            filename = f"static/ad_{ad['id']}.png"
            image.save(filename, "PNG")
            
            ad["image_url"] = f"/static/ad_{ad['id']}.png"
            
        except Exception as e:
            print(f"Error generating competitor image for {ad['id']}: {e}")
            ad["image_url"] = f"https://via.placeholder.com/1080x1080/3B82F6/ffffff?text=Competitor+Style"
    
    return ad_variations


def search_unsplash(query: str) -> Optional[str]:
    """Search Unsplash for stock image."""
    if not unsplash_key:
        return None
    
    try:
        url = "https://api.unsplash.com/search/photos"
        headers = {"Authorization": f"Client-ID {unsplash_key}"}
        params = {
            "query": query,
            "per_page": 1,
            "orientation": "squarish"
        }
        
        response = requests.get(url, headers=headers, params=params, timeout=10)
        data = response.json()
        
        if data.get("results"):
            return data["results"][0]["urls"]["regular"]
        return None
        
    except Exception as e:
        print(f"Error searching Unsplash: {e}")
        return None


def generate_stock_based(ad_variations: list[dict], product_info: dict) -> list[dict]:
    """Generate ads using stock images + text overlay."""
    
    product_title = product_info.get("title", "product")
    keywords = product_title.split()[:3]
    
    for i, ad in enumerate(ad_variations):
        try:
            # Search for relevant stock image
            search_query = f"{product_title} {' '.join(keywords)} lifestyle professional"
            image_url = search_unsplash(search_query)
            
            if image_url:
                # Download image
                response = requests.get(image_url, timeout=10)
                image = Image.open(BytesIO(response.content))
            else:
                # Create placeholder gradient
                image = Image.new('RGB', (1080, 1080), (139, 92, 246))
                draw = ImageDraw.Draw(image)
                for y in range(1080):
                    ratio = y / 1080
                    r = int(139 * (1 - ratio) + 100 * ratio)
                    g = int(92 * (1 - ratio) + 50 * ratio)
                    b = int(246 * (1 - ratio) + 200 * ratio)
                    draw.line([(0, y), (1080, y)], fill=(r, g, b))
            
            # Resize to square
            image = image.resize((1080, 1080), Image.Resampling.LANCZOS)
            
            # Add text overlay
            image = add_text_overlay(
                image,
                ad.get("headline", ""),
                ad.get("subhead", ""),
                ad.get("cta", "Shop Now →"),
                "bottom"
            )
            
            # Save image
            filename = f"static/ad_{ad['id']}.png"
            image.save(filename, "PNG")
            
            ad["image_url"] = f"/static/ad_{ad['id']}.png"
            
        except Exception as e:
            print(f"Error generating stock image for {ad['id']}: {e}")
            ad["image_url"] = f"https://via.placeholder.com/1080x1080/8B5CF6/ffffff?text=Stock+Image"
    
    return ad_variations


def generate_ai_based(ad_variations: list[dict], product_info: dict, foundation_data: dict = None) -> list[dict]:
    """Generate ads using AI image generation + text overlay."""
    
    if not api_key:
        print("No API key, falling back to stock mode")
        return generate_stock_based(ad_variations, product_info, foundation_data)
    
    product_title = product_info.get("title", "product")
    visual_desc = product_info.get("visualDesc", "")
    
    # Extract foundation context if available
    avatar_context = ""
    positioning_context = ""
    if foundation_data:
        avatar = foundation_data.get("avatar", "")
        positioning = foundation_data.get("positioning", "")
        if avatar:
            # Take first 500 chars of avatar for context
            avatar_context = avatar[:500] if len(avatar) > 500 else avatar
        if positioning:
            positioning_context = positioning[:500] if len(positioning) > 500 else positioning
    
    for ad in ad_variations:
        try:
            # Build generation prompt
            angle = ad.get("angle", "product")
            headline = ad.get("headline", "")
            hook = ad.get("hook", "")
            img_note = ad.get("imgNote", "")
            
            # Build comprehensive prompt with foundation data
            foundation_section = ""
            if avatar_context:
                foundation_section += f"\nTarget Customer: {avatar_context}\n"
            if positioning_context:
                foundation_section += f"\nBrand Positioning: {positioning_context}\n"
            
            prompt = f"""Professional product photography for: {product_title}

Visual direction: {visual_desc}
Style: {angle} advertising aesthetic
Headline theme: {headline}
Hook concept: {hook}
Image direction: {img_note}{foundation_section}

Create a compelling, high-quality product image for a Facebook/Instagram ad:
- Clean professional background
- Commercial photography style
- Product-focused composition
- Professional lighting
- Eye-catching and scroll-stopping
- Square format optimized for social media
- No text overlay needed (text will be added later)
- No emojis or special characters in the image

High quality, crisp details, 1:1 aspect ratio."""
            
            print(f"Generating image for ad {ad['id']}...")
            
            image = None
            
            if USE_NEW_SDK and client:
                # Use new SDK
                response = client.models.generate_content(
                    model='gemini-3.1-flash-image-preview',
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_modalities=['Text', 'Image']
                    )
                )
                
                # Extract image from response
                if response.candidates:
                    for candidate in response.candidates:
                        if candidate.content and candidate.content.parts:
                            for part in candidate.content.parts:
                                if part.inline_data:
                                    image = Image.open(BytesIO(part.inline_data.data))
                                    print(f"Found image in new SDK response for ad {ad['id']}")
                                    break
                                elif hasattr(part, 'image') and part.image:
                                    image = Image.open(BytesIO(part.image.data))
                                    print(f"Found image.data in new SDK response for ad {ad['id']}")
                                    break
            else:
                # Use old SDK
                model = genai.GenerativeModel('gemini-3.1-flash-image-preview')
                response = model.generate_content(prompt)
                
                # Extract image data from old SDK response
                if hasattr(response, 'parts') and response.parts:
                    for part in response.parts:
                        if hasattr(part, 'inline_data') and part.inline_data:
                            image_data = part.inline_data.data
                            image = Image.open(BytesIO(image_data))
                            print(f"Found inline_data in old SDK response for ad {ad['id']}")
                            break
            
            # If no image generated, create a nice gradient fallback
            if image is None:
                print(f"No image generated for ad {ad['id']}, creating fallback")
                image = Image.new('RGB', (1080, 1080), (30, 30, 40))
                draw = ImageDraw.Draw(image)
                # Create gradient
                for y in range(1080):
                    ratio = y / 1080
                    r = int(30 + 40 * ratio)
                    g = int(30 + 50 * ratio)
                    b = int(40 + 60 * ratio)
                    draw.line([(0, y), (1080, y)], fill=(r, g, b))
            
            # Ensure correct size
            image = image.resize((1080, 1080), Image.Resampling.LANCZOS)
            
            # Add text overlay
            image = add_text_overlay(
                image,
                headline,
                ad.get("subhead", ""),
                ad.get("cta", "Learn More →"),
                "bottom"
            )
            
            # Save image
            filename = f"static/ad_{ad['id']}.png"
            image.save(filename, "PNG")
            
            ad["image_url"] = f"/static/ad_{ad['id']}.png"
            print(f"✓ Saved image for ad {ad['id']} to {filename}")
            
        except Exception as e:
            import traceback
            print(f"✗ Error generating AI image for {ad['id']}: {e}")
            print(traceback.format_exc())
            # Fallback to gradient placeholder
            try:
                image = Image.new('RGB', (1080, 1080), (16, 185, 129))
                draw = ImageDraw.Draw(image)
                for y in range(1080):
                    ratio = y / 1080
                    r = int(16 * (1 - ratio) + 59 * ratio)
                    g = int(185 * (1 - ratio) + 130 * ratio)
                    b = int(129 * (1 - ratio) + 246 * ratio)
                    draw.line([(0, y), (1080, y)], fill=(r, g, b))
                image = add_text_overlay(image, ad.get("headline", ""), ad.get("subhead", ""), ad.get("cta", "Learn More →"), "bottom")
                filename = f"static/ad_{ad['id']}.png"
                image.save(filename, "PNG")
                ad["image_url"] = f"/static/ad_{ad['id']}.png"
            except:
                ad["image_url"] = f"https://via.placeholder.com/1080x1080/10B981/ffffff?text=AI+Generated"
    
    return ad_variations
