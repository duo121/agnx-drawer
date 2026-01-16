---
sidebar_position: 2
---

# MCP 服务器

通过模型上下文协议（MCP）在 AI 代理中使用 AGNX Drawer。

:::caution 预览功能
此功能为实验性功能，可能不稳定。
:::

## 支持的客户端

- Claude Desktop
- Cursor
- VS Code
- Claude Code CLI

## 配置

添加到你的 MCP 配置：

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

## 使用方法

配置完成后，让 AI 助手创建图表：

> "创建一个展示用户认证流程的流程图，包含登录、MFA 和会话管理"

图表会实时显示在浏览器中！

## 可用工具

MCP 服务器向 AI 代理暴露以下工具：

- `create_diagram` - 创建新图表
- `edit_diagram` - 修改现有图表
- `export_diagram` - 导出为各种格式
