---
sidebar_position: 2
---

# Getting Started

Get AGNX Drawer up and running in minutes.

## Online Demo

The fastest way to try AGNX Drawer is through our online demo - no installation required:

👉 [Try Live Demo](https://next-ai-drawio.jiang.jp/)

## Local Development

### Prerequisites

- Node.js 18+
- pnpm (recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/duo121/agnx-drawer
cd agnx-drawer

# Install dependencies
pnpm install

# Copy environment configuration
cp env.example .env.local

# Start development server
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### Configure AI Provider

Edit `.env.local` with your preferred AI provider:

```bash
# Example: OpenAI
OPENAI_API_KEY=your_api_key
AI_MODEL=gpt-4o
```

See [AI Provider Configuration](./configuration/ai-providers) for all supported providers.

## Desktop Application

Download native desktop apps from the [Releases page](https://github.com/duo121/agnx-drawer/releases):

- **Windows**: `.exe` installer
- **macOS**: `.dmg` package
- **Linux**: `.AppImage` or `.deb`

## Next Steps

- [Configure AI Providers](./configuration/ai-providers)
- [Deploy to Production](./deployment/vercel)
- [Explore Features](./features/dual-engine)
