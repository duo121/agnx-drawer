---
sidebar_position: 1
---

# 架构概览

AGNX Drawer 基于现代 Web 技术构建，注重可扩展性。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 前端 | React 19 |
| AI SDK | Vercel AI SDK v6 |
| Draw.io | react-drawio (iframe) |
| Excalidraw | @excalidraw/excalidraw v0.18 |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| 存储 | IndexedDB (idb) |

## 项目结构

```
agnx-drawer/
├── app/                    # Next.js App Router
│   ├── [lang]/             # 国际化路由 (en/zh/ja)
│   └── api/                # API 路由
├── components/             # React 组件
│   ├── chat/               # 聊天界面
│   ├── model/              # 模型配置
│   └── ui/                 # shadcn/ui 组件
├── hooks/                  # 自定义 React Hooks
├── server/                 # 服务端逻辑
├── shared/                 # 共享工具
└── packages/               # Monorepo 包
    └── mcp-server/         # MCP 服务器包
```

## 数据流

```
用户输入 → 聊天面板 → API 路由 → AI 提供商
              ↓
         工具处理器 → 图表引擎 → 画布
              ↓
         DiagramContext（状态管理）
```

## 核心组件

### DiagramContext

两个引擎的中央状态管理：
- 当前图表状态（XML/JSON）
- 引擎选择
- 历史记录跟踪
- 导出功能

### API 路由（`/api/chat`）

处理 AI 交互：
1. 访问码验证
2. 配额检查
3. 缓存查找
4. AI 流式响应
5. 工具调用处理
