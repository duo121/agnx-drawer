---
sidebar_position: 2
---

# Deploy to Cloudflare Workers

Deploy AGNX Drawer to Cloudflare's edge network.

## Prerequisites

- Cloudflare account
- Wrangler CLI installed

## Setup

### 1. Install Wrangler

```bash
pnpm add -g wrangler
wrangler login
```

### 2. Configure

The project includes `wrangler.jsonc` with default configuration.

### 3. Set Secrets

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put AI_MODEL
```

### 4. Deploy

```bash
pnpm run build
wrangler deploy
```

## Configuration

Edit `wrangler.jsonc` for custom settings:

```jsonc
{
  "name": "agnx-drawer",
  "compatibility_date": "2024-01-01",
  "main": "dist/_worker.js"
}
```

## Custom Domain

1. Go to Cloudflare Dashboard → Workers
2. Select your worker
3. Add custom domain in Settings → Triggers
