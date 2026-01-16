---
sidebar_position: 3
---

# Docker Deployment

Run AGNX Drawer in a Docker container.

## Quick Start

```bash
docker run -d \
  -p 3000:3000 \
  -e OPENAI_API_KEY=your_api_key \
  -e AI_MODEL=gpt-4o \
  ghcr.io/duo121/agnx-drawer:latest
```

## Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  agnx-drawer:
    image: ghcr.io/duo121/agnx-drawer:latest
    ports:
      - "3000:3000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - AI_MODEL=gpt-4o
    restart: unless-stopped
```

Run:
```bash
docker-compose up -d
```

## Build from Source

```bash
# Clone repository
git clone https://github.com/duo121/agnx-drawer
cd agnx-drawer

# Build image
docker build -t agnx-drawer .

# Run container
docker run -d -p 3000:3000 \
  -e OPENAI_API_KEY=your_key \
  agnx-drawer
```

## Environment Variables

Pass all environment variables using `-e` flag or `.env` file:

```bash
docker run -d -p 3000:3000 --env-file .env agnx-drawer
```
