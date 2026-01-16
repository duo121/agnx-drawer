# AGNX Drawer

<div align="center">

**AI-Powered Diagram Creation Tool - Chat, Draw, Visualize**

English | [中文](./README_CN.md)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Next.js](https://img.shields.io/badge/Next.js-16.x-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.x-61dafb)](https://react.dev/)

</div>

---

## 🙏 Acknowledgments

This project is a fork of [next-ai-draw-io](https://github.com/DayuanJiang/next-ai-draw-io) by **[@DayuanJiang](https://github.com/DayuanJiang)**. 

We extend our sincere gratitude to the original author for creating such an excellent open-source project. The innovative concept of combining AI with diagram creation has inspired this fork, and we continue to build upon the solid foundation they established.

**Original Project**: [https://github.com/DayuanJiang/next-ai-draw-io](https://github.com/DayuanJiang/next-ai-draw-io)

---

## ✨ Features

- **Dual Canvas Engine**: Support both Draw.io (professional/precise) and Excalidraw (hand-drawn/sketch) styles
- **LLM-Powered Creation**: Create and manipulate diagrams through natural language commands
- **Multi-Provider Support**: 10+ AI providers including OpenAI, Anthropic, Google, DeepSeek, and more
- **Image-Based Replication**: Upload existing diagrams and have AI replicate them
- **PDF & Text Upload**: Extract content from documents to generate diagrams
- **Cloud Architecture Support**: Specialized support for AWS, GCP, Azure architecture diagrams
- **DSL Support**: PlantUML for Draw.io, Mermaid for Excalidraw
- **MCP Server**: Integration with Claude Desktop, Cursor, VS Code via Model Context Protocol
- **Desktop App**: Native applications for Windows, macOS, and Linux (Electron & Tauri)
- **Version History**: Track all changes and restore previous versions

## 📸 Examples

<div align="center">
<table width="100%">
  <tr>
    <td colspan="2" valign="top" align="center">
      <strong>Animated Transformer Connectors</strong><br />
      <p><strong>Prompt:</strong> Give me an <strong>animated connector</strong> diagram of transformer's architecture.</p>
      <img src="./public/animated_connectors.svg" alt="Transformer Architecture with Animated Connectors" width="480" />
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <strong>GCP Architecture Diagram</strong><br />
      <p><strong>Prompt:</strong> Generate a GCP architecture diagram with <strong>GCP icons</strong>.</p>
      <img src="./public/gcp_demo.svg" alt="GCP Architecture Diagram" width="480" />
    </td>
    <td width="50%" valign="top">
      <strong>AWS Architecture Diagram</strong><br />
      <p><strong>Prompt:</strong> Generate an AWS architecture diagram with <strong>AWS icons</strong>.</p>
      <img src="./public/aws_demo.svg" alt="AWS Architecture Diagram" width="480" />
    </td>
  </tr>
</table>
</div>

## 🚀 Quick Start

### Online Demo

Try it directly without installation:

[![Live Demo](./public/live-demo-button.svg)](https://agnx-drawer.vercel.app/)

> **Bring Your Own API Key**: You can use your own API key to bypass usage limits. Click the Settings icon in the chat panel to configure.

### Local Development

```bash
# Clone the repository
git clone https://github.com/duo121/agnx-drawer
cd agnx-drawer

# Install dependencies
pnpm install

# Configure environment
cp env.example .env.local

# Start development server
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### Desktop Application

Download from the [Releases page](https://github.com/duo121/agnx-drawer/releases) for Windows, macOS, or Linux.

## 📦 Deployment

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fduo121%2Fagnx-drawer)

### EdgeOne Pages

[![Deploy to EdgeOne Pages](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https%3A%2F%2Fgithub.com%2Fduo121%2Fagnx-drawer)

Deploying through EdgeOne Pages also grants you daily free quota for DeepSeek models.

### Other Deployment Options

- [Cloudflare Deploy Guide](./docs/en/cloudflare-deploy.md)
- [Docker Guide](./docs/en/docker.md)

## � Configuration

### AI Providers

Configure your preferred AI provider in `.env.local`:

```bash
# OpenAI
OPENAI_API_KEY=your_api_key
AI_MODEL=gpt-4o

# Anthropic
ANTHROPIC_API_KEY=your_api_key
AI_MODEL=claude-sonnet-4-5-20250514

# Google
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key
AI_MODEL=gemini-2.0-flash

# DeepSeek
DEEPSEEK_API_KEY=your_api_key
AI_MODEL=deepseek-chat
```

See [AI Provider Configuration](./docs/en/ai-providers.md) for all supported providers.

## 🔌 MCP Server (Preview)

Use with AI agents like Claude Desktop, Cursor, and VS Code via MCP:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["@next-ai-drawio/mcp-server@latest"]
    }
  }
}
```

Then ask Claude to create diagrams:
> "Create a flowchart showing user authentication with login, MFA, and session management"

## 🛠 Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| Frontend | React 19 |
| AI SDK | Vercel AI SDK v6 |
| Draw.io | react-drawio |
| Excalidraw | @excalidraw/excalidraw v0.18 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Storage | IndexedDB |

## 📖 Documentation

- [AI Provider Configuration](./docs/en/ai-providers.md)
- [Docker Deployment](./docs/en/docker.md)
- [Cloudflare Deployment](./docs/en/cloudflare-deploy.md)
- [Architecture Overview](./docs/ARCHITECTURE.md)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=duo121/agnx-drawer&type=date&legend=top-left)](https://www.star-history.com/#duo121/agnx-drawer&type=date&legend=top-left)
