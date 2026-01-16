# AGNX Drawer

<div align="center">

**AI 驱动的图表创建工具 - 对话、绘制、可视化**

[English](./README.md) | 中文

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Next.js](https://img.shields.io/badge/Next.js-16.x-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.x-61dafb)](https://react.dev/)

</div>

---

## 🙏 致谢

本项目是基于 **[@DayuanJiang](https://github.com/DayuanJiang)** 的 [next-ai-draw-io](https://github.com/DayuanJiang/next-ai-draw-io) 进行二次开发的。

我们衷心感谢原作者创建了如此优秀的开源项目。将 AI 与图表创建相结合的创新理念启发了本项目的诞生，我们在原项目坚实的基础上继续构建和完善。

**原始项目**: [https://github.com/DayuanJiang/next-ai-draw-io](https://github.com/DayuanJiang/next-ai-draw-io)

---

## ✨ 功能特性

- **双画板引擎**: 支持 Draw.io（专业/精确风格）和 Excalidraw（手绘/草图风格）
- **LLM 驱动创建**: 通过自然语言命令创建和操作图表
- **多提供商支持**: 支持 10+ AI 提供商，包括 OpenAI、Anthropic、Google、DeepSeek 等
- **图像复制**: 上传现有图表，让 AI 自动复制
- **PDF 和文本上传**: 从文档中提取内容生成图表
- **云架构图支持**: 专门支持 AWS、GCP、Azure 架构图
- **DSL 支持**: Draw.io 支持 PlantUML，Excalidraw 支持 Mermaid
- **MCP 服务器**: 通过模型上下文协议与 Claude Desktop、Cursor、VS Code 集成
- **桌面应用**: 支持 Windows、macOS、Linux 的原生应用（Electron 和 Tauri）
- **版本历史**: 跟踪所有更改并恢复之前的版本

## 📸 示例

以下是一些示例提示词及其生成的图表：

<div align="center">
<table width="100%">
  <tr>
    <td colspan="2" valign="top" align="center">
      <strong>动画 Transformer 连接器</strong><br />
      <p><strong>提示词：</strong> 给我一个带有<strong>动画连接器</strong>的 Transformer 架构图。</p>
      <img src="./public/animated_connectors.svg" alt="带动画连接器的 Transformer 架构" width="480" />
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <strong>GCP 架构图</strong><br />
      <p><strong>提示词：</strong> 使用 <strong>GCP 图标</strong>生成一个 GCP 架构图。</p>
      <img src="./public/gcp_demo.svg" alt="GCP 架构图" width="480" />
    </td>
    <td width="50%" valign="top">
      <strong>AWS 架构图</strong><br />
      <p><strong>提示词：</strong> 使用 <strong>AWS 图标</strong>生成一个 AWS 架构图。</p>
      <img src="./public/aws_demo.svg" alt="AWS 架构图" width="480" />
    </td>
  </tr>
</table>
</div>

## 🚀 快速开始

### 在线演示

无需安装，直接试用：

[![Live Demo](./public/live-demo-button.svg)](https://agnx-drawer.vercel.app/)

> **使用自己的 API Key**：你可以使用自己的 API Key 来绕过演示站点的用量限制。点击聊天面板中的设置图标即可配置。

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/duo121/agnx-drawer
cd agnx-drawer

# 安装依赖
pnpm install

# 配置环境变量
cp env.example .env.local

# 启动开发服务器
pnpm dev
```

在浏览器中打开 [http://localhost:3001](http://localhost:3001)。

### 桌面应用

从 [Releases 页面](https://github.com/duo121/agnx-drawer/releases) 下载适用于 Windows、macOS 或 Linux 的版本。

## 📦 部署

### Vercel（推荐）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fduo121%2Fagnx-drawer)

### EdgeOne Pages

[![Deploy to EdgeOne Pages](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https%3A%2F%2Fgithub.com%2Fduo121%2Fagnx-drawer)

通过 EdgeOne Pages 部署还可获得每日免费的 DeepSeek 模型额度。

### 其他部署方式

- [Cloudflare 部署指南](./docs/cn/cloudflare-deploy.md)
- [Docker 指南](./docs/cn/docker.md)

## 🔧 配置

### AI 提供商

在 `.env.local` 中配置你偏好的 AI 提供商：

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

查看 [AI 提供商配置](./docs/cn/ai-providers.md) 了解所有支持的提供商。

## 🔌 MCP 服务器（预览）

通过 MCP（模型上下文协议）在 Claude Desktop、Cursor 和 VS Code 等 AI 代理中使用：

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

然后让 Claude 创建图表：
> "创建一个展示用户认证流程的流程图，包含登录、MFA 和会话管理"

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 前端 | React 19 |
| AI SDK | Vercel AI SDK v6 |
| Draw.io | react-drawio |
| Excalidraw | @excalidraw/excalidraw v0.18 |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| 存储 | IndexedDB |

## 📖 文档

- [AI 提供商配置](./docs/cn/ai-providers.md)
- [Docker 部署](./docs/cn/docker.md)
- [Cloudflare 部署](./docs/cn/cloudflare-deploy.md)
- [架构概览](./docs/ARCHITECTURE.md)

## 🤝 贡献

欢迎贡献！请随时提交 Pull Request。

## 📄 许可证

本项目采用 Apache 2.0 许可证 - 详见 [LICENSE](LICENSE) 文件。

---

## ⭐ Star 历史

[![Star History Chart](https://api.star-history.com/svg?repos=duo121/agnx-drawer&type=date&legend=top-left)](https://www.star-history.com/#duo121/agnx-drawer&type=date&legend=top-left)
