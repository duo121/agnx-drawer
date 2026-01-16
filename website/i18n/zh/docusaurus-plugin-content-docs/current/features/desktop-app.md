---
sidebar_position: 3
---

# 桌面应用

适用于 Windows、macOS 和 Linux 的原生桌面应用。

## 下载

从 [GitHub Releases](https://github.com/duo121/agnx-drawer/releases) 获取最新版本。

| 平台 | 格式 |
|------|------|
| Windows | `.exe` 安装程序 |
| macOS | `.dmg` 安装包 |
| Linux | `.AppImage`、`.deb` |

## 特性

- **离线可用**：配合本地 AI（如 Ollama）可离线使用
- **原生性能**：基于 Electron/Tauri 构建
- **系统集成**：文件关联、菜单栏
- **自动更新**：自动更新通知

## 从源码构建

### Electron

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm electron:dev

# 生产构建
pnpm electron:build
```

### Tauri

```bash
# 安装 Rust 和 Tauri 前置要求
# 参见：https://tauri.app/v1/guides/getting-started/prerequisites

# 开发模式
pnpm tauri:dev

# 生产构建
pnpm tauri:build
```

## 配合 Ollama 本地 AI

完全离线使用：

1. 安装 [Ollama](https://ollama.ai)
2. 拉取模型：`ollama pull llama3.2`
3. 在应用设置中配置：
   - 提供商：Ollama
   - 模型：llama3.2
   - URL：http://localhost:11434
