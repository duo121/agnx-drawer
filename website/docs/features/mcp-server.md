---
sidebar_position: 2
---

# MCP Server

Use AGNX Drawer with AI agents via Model Context Protocol (MCP).

:::caution Preview Feature
This feature is experimental and may not be stable.
:::

## Supported Clients

- Claude Desktop
- Cursor
- VS Code
- Claude Code CLI

## Configuration

Add to your MCP configuration:

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

## Claude Code CLI

```bash
claude mcp add drawio -- npx @next-ai-drawio/mcp-server@latest
```

## Usage

Once configured, ask your AI assistant to create diagrams:

> "Create a flowchart showing user authentication with login, MFA, and session management"

The diagram appears in your browser in real-time!

## Available Tools

The MCP server exposes these tools to AI agents:

- `create_diagram` - Create a new diagram
- `edit_diagram` - Modify existing diagram
- `export_diagram` - Export to various formats

## Troubleshooting

### Server Not Starting

Ensure `npx` is available in your PATH and you have internet access.

### Diagram Not Appearing

Check that the AGNX Drawer web app is running and accessible.
