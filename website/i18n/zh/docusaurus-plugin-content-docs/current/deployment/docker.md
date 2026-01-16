---
sidebar_position: 3
---

# Docker 部署

在 Docker 容器中运行 AGNX Drawer。

## 快速开始

```bash
docker run -d \
  -p 3000:3000 \
  -e OPENAI_API_KEY=your_api_key \
  -e AI_MODEL=gpt-4o \
  ghcr.io/duo121/agnx-drawer:latest
```

## Docker Compose

创建 `docker-compose.yml`：

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

运行：
```bash
docker-compose up -d
```

## 从源码构建

```bash
# 克隆仓库
git clone https://github.com/duo121/agnx-drawer
cd agnx-drawer

# 构建镜像
docker build -t agnx-drawer .

# 运行容器
docker run -d -p 3000:3000 \
  -e OPENAI_API_KEY=your_key \
  agnx-drawer
```
