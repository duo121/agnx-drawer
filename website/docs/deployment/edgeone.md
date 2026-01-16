---
sidebar_position: 4
---

# Deploy to EdgeOne Pages

Deploy to Tencent EdgeOne Pages with one click.

## One-Click Deploy

[![Deploy to EdgeOne Pages](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https%3A%2F%2Fgithub.com%2Fduo121%2Fagnx-drawer)

## Benefits

- Global CDN distribution
- Free DeepSeek model quota included
- Automatic SSL certificates
- Easy environment variable management

## Manual Setup

1. Go to [EdgeOne Pages Console](https://console.cloud.tencent.com/edgeone/pages)
2. Click "Create Project"
3. Connect your GitHub repository
4. Configure build settings:
   - Build command: `pnpm build`
   - Output directory: `.next`
5. Add environment variables
6. Deploy

## Free AI Quota

Deploying through EdgeOne Pages grants you daily free quota for DeepSeek models. See [EdgeOne AI documentation](https://edgeone.cloud.tencent.com/pages/document/169925463311781888) for details.
