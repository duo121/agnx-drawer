---
sidebar_position: 4
---

# 部署到 EdgeOne Pages

一键部署到腾讯云 EdgeOne Pages。

## 一键部署

[![Deploy to EdgeOne Pages](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https%3A%2F%2Fgithub.com%2Fduo121%2Fagnx-drawer)

## 优势

- 全球 CDN 分发
- 包含免费 DeepSeek 模型配额
- 自动 SSL 证书
- 便捷的环境变量管理

## 手动设置

1. 前往 [EdgeOne Pages 控制台](https://console.cloud.tencent.com/edgeone/pages)
2. 点击 "创建项目"
3. 连接你的 GitHub 仓库
4. 配置构建设置：
   - 构建命令：`pnpm build`
   - 输出目录：`.next`
5. 添加环境变量
6. 部署

## 免费 AI 配额

通过 EdgeOne Pages 部署可获得每日免费的 DeepSeek 模型配额。详见 [EdgeOne AI 文档](https://edgeone.cloud.tencent.com/pages/document/169925463311781888)。
