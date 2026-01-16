---
sidebar_position: 2
---

# 部署到 Cloudflare Workers

将 AGNX Drawer 部署到 Cloudflare 边缘网络。

## 前置要求

- Cloudflare 账户
- 已安装 Wrangler CLI

## 设置步骤

### 1. 安装 Wrangler

```bash
pnpm add -g wrangler
wrangler login
```

### 2. 配置

项目已包含 `wrangler.jsonc` 默认配置。

### 3. 设置密钥

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put AI_MODEL
```

### 4. 部署

```bash
pnpm run build
wrangler deploy
```

## 自定义域名

1. 前往 Cloudflare Dashboard → Workers
2. 选择你的 Worker
3. 在 Settings → Triggers 中添加自定义域名
