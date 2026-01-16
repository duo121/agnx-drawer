---
sidebar_position: 1
---

# 双画板引擎

AGNX Drawer 支持两种图表引擎，适用于不同场景。

## Draw.io 引擎

**风格**：专业、精确的图表

**适用场景**：
- 架构图
- 流程图
- 云基础设施（AWS、GCP、Azure）
- 技术文档

**特性**：
- 丰富的图形库
- 云提供商图标
- PlantUML 支持
- 导出为 SVG、PNG、XML

## Excalidraw 引擎

**风格**：手绘、草图风格的图表

**适用场景**：
- 头脑风暴
- 快速草图
- 非正式演示
- 白板风格图表

**特性**：
- 手绘美学
- Mermaid 图表支持
- 协作感
- 导出为 PNG、SVG、JSON

## 切换引擎

点击聊天面板头部的引擎切换按钮，即可在 Draw.io 和 Excalidraw 之间切换。

切换时图表会被保留 - 每个引擎维护自己的状态。

## DSL 支持

| 引擎 | DSL | 示例 |
|------|-----|------|
| Draw.io | PlantUML | `@startuml ... @enduml` |
| Excalidraw | Mermaid | `graph TD; A-->B` |

## 对比

| 特性 | Draw.io | Excalidraw |
|------|---------|------------|
| 数据格式 | XML | JSON |
| 风格 | 专业 | 手绘 |
| 云图标 | ✅ 完整支持 | ❌ 有限 |
| DSL | PlantUML | Mermaid |
| 最佳用途 | 文档 | 头脑风暴 |
