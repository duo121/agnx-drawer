---
sidebar_position: 1
---

# Architecture Overview

AGNX Drawer is built on modern web technologies with a focus on extensibility.

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| Frontend | React 19 |
| AI SDK | Vercel AI SDK v6 |
| Draw.io | react-drawio (iframe) |
| Excalidraw | @excalidraw/excalidraw v0.18 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Storage | IndexedDB (idb) |

## Project Structure

```
agnx-drawer/
├── app/                    # Next.js App Router
│   ├── [lang]/             # i18n routes (en/zh/ja)
│   └── api/                # API routes
├── components/             # React components
│   ├── chat/               # Chat interface
│   ├── model/              # Model configuration
│   └── ui/                 # shadcn/ui components
├── hooks/                  # Custom React hooks
├── server/                 # Server-side logic
├── shared/                 # Shared utilities
└── packages/               # Monorepo packages
    └── mcp-server/         # MCP server package
```

## Data Flow

```
User Input → Chat Panel → API Route → AI Provider
                ↓
         Tool Handlers → Diagram Engine → Canvas
                ↓
         DiagramContext (State Management)
```

## Key Components

### DiagramContext

Central state management for both engines:
- Current diagram state (XML/JSON)
- Engine selection
- History tracking
- Export functions

### API Route (`/api/chat`)

Handles AI interactions:
1. Access code validation
2. Quota checking
3. Cache lookup
4. AI streaming response
5. Tool call processing

### Diagram Engines

Abstraction layer for different canvas implementations:
- Common interface for tools
- Engine-specific system prompts
- Format conversion (PlantUML/Mermaid)
