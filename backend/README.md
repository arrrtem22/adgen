# AI Ad Creative Generator - Backend

FastAPI backend for generating self-evolving Meta ad creatives.

## Features

- **Product Scraping**: Extract product info from URLs (title, description, price, images)
- **AI Ad Copy Generation**: Generate variations using Gemini 2.0 Flash
- **Image Generation**: Three modes for creating ad visuals
  - **Competitor Mode**: Match competitor ad styles
  - **Stock Mode**: Use Unsplash images with text overlays
  - **AI Mode**: Generate images with Gemini
- **Mock Metrics**: Realistic CTR, impressions, and clicks simulation
- **A/B Testing Simulation**: Project performance over time

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create .env file:
```bash
cp .env.example .env
```

3. Add your API keys to `.env`:
```
GEMINI_API_KEY=your_gemini_api_key_here
UNSPLASH_ACCESS_KEY=your_unsplash_key_here  # Optional, for stock images
```

Get your Gemini API key at: https://makersuite.google.com/app/apikey

4. Run server:
```bash
python main.py
```

Server runs on http://localhost:8000

## API Endpoints

### Health Check
```
GET /health
```

### Scrape Product
```
POST /scrape
{
  "url": "https://example.com/product"
}
```

### Generate Ads
```
POST /generate
{
  "mode": "competitor" | "stock" | "ai",
  "product_url": "https://example.com/product",
  "competitor_image": "base64string (optional)",
  "iteration": false,
  "previous_winners": ["ad_1", "ad_2"] (optional),
  "batch_config": {
    "count": 8,
    "focus": "test fear angle",
    "angles": ["transformation", "social proof"],
    "dryRun": true,
    "modeRatio": {"A": 50, "B": 30, "C": 20}
  }
}
```

### Upload Competitor Image
```
POST /upload/competitor
Content-Type: multipart/form-data
file: <image_file>
```

## Frontend Integration

The backend is designed to work with the AdGen frontend. The API accepts and returns data structures that match the frontend's state format:

- **AdVariation**: Includes fields like `angle`, `mode`, `hook`, `headline`, `bullets`, `cta`, `imgNote`
- **BatchConfig**: Matches the frontend's batch configuration
- **Project**: Full project state with brand config, angles, compliance

### Example Frontend Integration

```typescript
// Frontend API call
const response = await fetch('http://localhost:8000/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'stock',
    product_url: productUrl,
    iteration: true,
    previous_winners: ['transformation', 'social proof'],
    batch_config: {
      count: 8,
      focus: 'test new angles',
      angles: ['fear', 'urgency'],
      dryRun: false,
      modeRatio: { A: 50, B: 30, C: 20 }
    }
  })
});

const data = await response.json();
// data.ads contains the generated variations
```

## Testing

Run tests:
```bash
python test_api.py
```

Test with curl:
```bash
# Health check
curl http://localhost:8000/health

# Generate ads
curl -X POST http://localhost:8000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "stock",
    "product_url": "https://example.com/product",
    "iteration": false
  }'

# Scrape product
curl -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

## Architecture

```
backend/
├── main.py              # FastAPI app and routes
├── models/
│   └── schemas.py       # Pydantic models
├── services/
│   ├── scraper.py       # URL scraping with BeautifulSoup
│   ├── ad_generator.py  # Gemini ad copy generation
│   ├── image_generator.py  # Image generation (3 modes)
│   └── metrics.py       # Mock metrics & A/B testing
├── static/              # Generated images
├── test_api.py          # API tests
└── requirements.txt
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for AI generation |
| `UNSPLASH_ACCESS_KEY` | No | Unsplash API key for stock images |

## Notes

- Without `GEMINI_API_KEY`, the API falls back to mock data
- Without `UNSPLASH_ACCESS_KEY`, stock mode uses placeholder images
- Generated images are saved to `static/` and served at `/static/{filename}`
- The API supports CORS for frontend development on ports 3000 and 5173
