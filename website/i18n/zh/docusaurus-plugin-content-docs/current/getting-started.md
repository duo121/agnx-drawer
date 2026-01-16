---
sidebar_position: 2
---

# 快速开始

几分钟内启动 AGNX Drawer。

## 在线演示

最快的体验方式是通过在线演示 - 无需安装：

👉 [在线试用](https://next-ai-drawio.jiang.jp/)

## 本地开发

### 前置要求

- Node.js 18+
- pnpm（推荐）

### 安装

```bash
# 克隆仓库
git clone https://github.com/duo121/agnx-drawer
cd agnx-drawer

# 安装依赖
pnpm install

# 复制环境配置
cp env.example .env.local

# 启动开发服务器
pnpm dev
```

在浏览器中打开 [http://localhost:3001](http://localhost:3001)。

### 配置 AI 提供商

编辑 `.env.local`，配置你偏好的 AI 提供商：

```bash
# 示例：OpenAI
OPENAI_API_KEY=your_api_key
AI_MODEL=gpt-4o
```

查看 [AI 提供商配置](./configuration/ai-providers) 了解所有支持的提供商。

## 桌面应用

从 [Releases 页面](https://github.com/duo121/agnx-drawer/releases) 下载原生桌面应用：

- **Windows**: `.exe` 安装程序
- **macOS**: `.dmg` 安装包
- **Linux**: `.AppImage` 或 `.deb`

## 下一步

- [配置 AI 提供商](./configuration/ai-providers)
- [部署到生产环境](./deployment/vercel)
- [探索功能](./features/dual-engine)
