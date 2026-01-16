# Skills Directory Index

本目录包含 AI 绘图助手可动态加载的技能提示词。AI 可通过 `read_skill_file` 工具读取所需技能。

## 目录结构

### 引擎专用提示词 (`_engines/`)
引擎核心系统提示词，根据当前激活引擎自动加载。

- `_engines/drawio/SKILL.md` - Draw.io 引擎完整提示词（XML 生成、工具使用、布局规则）
- `_engines/excalidraw/SKILL.md` - Excalidraw 引擎完整提示词（JSON 生成、元素绑定、样式）

### DSL 转换器 (`_dsl/`)
文本到图表的 DSL 语言支持。

- `_dsl/plantuml/SKILL.md` - PlantUML 语法（支持类图、序列图、状态图等）
- `_dsl/mermaid/SKILL.md` - Mermaid 语法（支持流程图、时序图、甘特图等）

### 图标库 (`icons/`)
云服务和技术栈图标形状库。

- `icons/aws/SKILL.md` - AWS 架构图标
- `icons/azure/SKILL.md` - Azure 架构图标  
- `icons/gcp/SKILL.md` - Google Cloud 图标
- `icons/k8s/SKILL.md` - Kubernetes 图标
- `icons/network/SKILL.md` - 网络设备图标

### 图表模式 (根目录)
特定类型图表的绘制模式和最佳实践。

- `flowchart/SKILL.md` - 流程图绘制（Draw.io 引擎）
- `excalidraw-basics/SKILL.md` - Excalidraw 基础用法
- `excalidraw-flowchart/SKILL.md` - Excalidraw 流程图

## 使用指南

1. **引擎提示词**: 系统根据 `engineId` 自动注入对应引擎的 SKILL.md
2. **按需加载**: AI 根据用户需求调用 `read_skill_file` 读取特定技能
3. **DSL 支持**: 用户使用 `/plantuml` 或 `/mermaid` 命令时自动加载对应 skill
4. **图标库**: 创建云架构图时，先调用 `list_icon_libraries` 查看可用库

## 技能文件格式

每个 SKILL.md 包含 frontmatter 元数据：

```yaml
---
name: skill-name
description: 技能描述，用于 AI 判断是否需要加载
engine: drawio | excalidraw | all  # 适用引擎
---
```
