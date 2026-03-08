# Deploy to Vercel

This guide will help you deploy the AdGen application to Vercel.

## Prerequisites

1. [Vercel Account](https://vercel.com/signup)
2. [Vercel CLI](https://vercel.com/docs/cli) (optional, for local testing)
3. Gemini API Key from [Google AI Studio](https://makersuite.google.com/app/apikey)
4. (Optional) Unsplash API Key from [Unsplash Developers](https://unsplash.com/developers)

## Deployment Steps

### 1. Push to GitHub

Make sure your code is in a GitHub repository:

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

### 2. Connect to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repository
4. Select the repository containing this project

### 3. Configure Project Settings

During setup, configure the following:

#### Build & Output Settings
- **Framework Preset**: Other (or leave blank)
- **Build Command**: `npm run build`
- **Output Directory**: `frontend/dist`

#### Environment Variables

Add these environment variables in the Vercel dashboard:

| Name | Value | Required |
|------|-------|----------|
| `ANTHROPIC_API_KEY` | Your Anthropic Claude API key | Recommended |
| `GEMINI_API_KEY` | Your Google Gemini API key | Alternative |
| `UNSPLASH_ACCESS_KEY` | Your Unsplash API key (optional) | No |

**Note**: Set either `ANTHROPIC_API_KEY` (for Claude) or `GEMINI_API_KEY` (for Gemini). If both are set, Claude will be used for text generation. Image generation always uses `gemini-3.1-flash-image-preview`.

### 4. Deploy

Click "Deploy" and wait for the build to complete.

## Project Structure for Vercel

```
/
├── api/                    # Vercel Serverless Functions
│   └── index.py           # Main API entry point
├── backend/               # Python backend code
│   ├── main.py           # FastAPI application
│   ├── models/           # Pydantic schemas
│   └── services/         # Business logic
├── frontend/             # React frontend
│   ├── src/             # Source code
│   └── dist/            # Build output
├── vercel.json          # Vercel configuration
├── package.json         # Root package.json for build
└── requirements.txt     # Python dependencies
```

## API Routes

The backend API is available at `/api/*`:

- `GET/POST /api/*` - All backend endpoints
- `POST /api/generate/batch` - Generate ad variations
- `POST /api/generate/images` - Generate images for ads
- `POST /api/scrape` - Scrape product information
- `GET /api/health` - Health check

## Troubleshooting

### Build Failures

If the build fails:

1. Check that all imports are correct
2. Ensure `requirements.txt` includes all dependencies
3. Verify Python version (3.9 recommended)

### API Errors

If API calls fail after deployment:

1. Check Environment Variables are set in Vercel Dashboard
2. Verify `GEMINI_API_KEY` is valid
3. Check Vercel Functions logs for errors

### Static Files

Generated images are stored in `/static/` folder. Note that Vercel's serverless functions have ephemeral storage, so images may not persist between deployments.

For persistent storage, consider:
- Using cloud storage (AWS S3, Cloudflare R2)
- Using Vercel Blob Storage
- Downloading images immediately after generation

## Local Development

```bash
# Terminal 1: Backend
cd backend
pip install -r requirements.txt
python main.py

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

The frontend will proxy API requests to localhost:8000 via the `/api` route.

## Important Notes

1. **File Uploads**: Large file uploads may hit Vercel's size limits (4.5MB for serverless functions)

2. **Image Generation**: Image generation can take 10-30 seconds per image. Vercel has a 60-second timeout on hobby plans.

3. **Static Files**: The `/static` folder is ephemeral. Images will be lost on redeployment. Consider implementing cloud storage for production use.

4. **CORS**: The backend allows all origins (`*`). For production, you may want to restrict this to your specific domain.
