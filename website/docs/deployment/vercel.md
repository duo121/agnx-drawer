---
sidebar_position: 1
---

# Deploy to Vercel

The easiest way to deploy AGNX Drawer.

## One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fduo121%2Fagnx-drawer)

## Manual Deployment

### 1. Fork the Repository

Fork [agnx-drawer](https://github.com/duo121/agnx-drawer) to your GitHub account.

### 2. Import to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/new)
2. Click "Import Project"
3. Select your forked repository

### 3. Configure Environment Variables

In Vercel project settings, add your environment variables:

```
OPENAI_API_KEY=your_api_key
AI_MODEL=gpt-4o
```

### 4. Deploy

Click "Deploy" and wait for the build to complete.

## Custom Domain

1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed

## Troubleshooting

### Build Fails

Ensure all required environment variables are set in Vercel dashboard.

### API Errors

Check that your AI provider API key is valid and has sufficient quota.
