# GitHub Secrets Setup for CI/CD

To enable automatic deployment to Vercel on every commit, you need to set up these secrets in your GitHub repository.

## Required Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

### 1. VERCEL_TOKEN

Get your Vercel token:
```bash
npx vercel login
npx vercel tokens create
# Or go to https://vercel.com/account/tokens
```

Add as secret: `VERCEL_TOKEN`

### 2. VITE_API_URL (Optional)

If you want to set a specific API URL for the build:
- Production: `https://your-domain.vercel.app/api`
- Or leave empty to use relative paths

Add as secret: `VITE_API_URL`

## Vercel Environment Variables

Also set these in your Vercel dashboard (Project Settings → Environment Variables):

| Variable | Value | Required |
|----------|-------|----------|
| `ANTHROPIC_API_KEY` | Your Claude API key | Recommended |
| `GEMINI_API_KEY` | Your Gemini API key | Alternative |
| `UNSPLASH_ACCESS_KEY` | Your Unsplash API key | Optional |

## How It Works

1. Every push to any branch triggers the workflow
2. GitHub Actions builds the frontend
3. Vercel CLI deploys to production
4. Your site is live with the latest changes!

## Testing Locally

Test the build process:
```bash
cd frontend
npm ci
npm run build
```

Test Vercel deployment locally:
```bash
vercel --prod
```
