# AI Ad Creative Generator - Backend

FastAPI backend for generating self-evolving Meta ad creatives.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create .env file:
```bash
cp .env.example .env
# Add your Gemini API key
```

3. Run server:
```bash
python main.py
```

Server runs on http://localhost:8000

## API Endpoints

### POST /generate

Generate ad variations

**Request body:**
```json
{
  "mode": "competitor" | "stock" | "ai",
  "product_url": "https://example.com/product",
  "competitor_image": "base64string (optional)",
  "iteration": false,
  "previous_winners": ["ad_1", "ad_2"] (optional)
}
```

## Implementation Status

- [x] Project structure
- [x] FastAPI setup
- [x] API schemas
- [ ] Product scraping (services/scraper.py)
- [ ] Ad copy generation (services/ad_generator.py)
- [ ] Competitor-based image generation
- [ ] Stock-based image generation
- [ ] AI-based image generation
- [ ] Text overlay function
- [ ] Mock metrics logic

## TODO Priority

1. **Start with scraper.py** - Get product data extraction working
2. **Then ad_generator.py** - Get Gemini copy generation working
3. **Then image_generator.py (stock mode first)** - Easiest mode to implement
4. **Then add AI image mode** - Gemini image generation
5. **Finally competitor mode** - Most complex, optional for MVP

Each file has detailed TODO comments explaining what to implement.

## Testing

You can test the API with curl:

```bash
curl -X POST http://localhost:8000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "stock",
    "product_url": "https://example.com/product",
    "iteration": false
  }'
```

Or visit http://localhost:8000/docs for interactive Swagger UI.
