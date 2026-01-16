---
sidebar_position: 1
---

# 部署到 Vercel

部署 AGNX Drawer 最简单的方式。

## 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fduo121%2Fagnx-drawer)

## 手动部署

### 1. Fork 仓库

将 [agnx-drawer](https://github.com/duo121/agnx-drawer) Fork 到你的 GitHub 账户。

### 2. 导入到 Vercel

1. 前往 [Vercel Dashboard](https://vercel.com/new)
2. 点击 "Import Project"
3. 选择你 Fork 的仓库

### 3. 配置环境变量

在 Vercel 项目设置中添加环境变量：

```
OPENAI_API_KEY=your_api_key
AI_MODEL=gpt-4o
```

### 4. 部署

点击 "Deploy" 等待构建完成。

## 自定义域名

1. 前往 Project Settings → Domains
2. 添加你的自定义域名
3. 按照指示配置 DNS 记录

## 故障排除

### 构建失败

确保在 Vercel 控制台中设置了所有必需的环境变量。

### API 错误

检查 AI 提供商的 API Key 是否有效且有足够的配额。
