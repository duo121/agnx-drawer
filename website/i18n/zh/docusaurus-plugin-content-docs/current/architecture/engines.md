---
sidebar_position: 2
---

# 图表引擎

双引擎架构实现灵活的图表创建。

## 引擎接口

每个引擎实现通用接口：

```typescript
interface DiagramEngine {
  id: string                    // "drawio" | "excalidraw"
  name: string                  // 显示名称
  dataFormat: "xml" | "json"    // 数据格式

  getSystemPrompt(): string     // AI 系统提示词
  getTools(): Record<string, Tool>  // AI 工具
  
  // 可选
  EditorComponent?: React.ComponentType
  handleToolCall?: (call, context) => Promise<void>
  export?: (format, context) => Promise<any>
}
```

## Draw.io 引擎

**数据格式**：XML (mxCell)

**工具**：
- `display_diagram` - 显示新图表
- `edit_diagram` - 修改现有图表
- `append_diagram` - 续传截断的 XML
- `convert_plantuml_to_drawio` - PlantUML 转换
- `get_shape_library` - 获取图形文档

## Excalidraw 引擎

**数据格式**：JSON (elements 数组)

**工具**：
- `display_excalidraw` - 显示新场景
- `edit_excalidraw` - 修改场景（替换/补丁/删除）
- `append_excalidraw` - 续传截断的元素
- `convert_mermaid_to_excalidraw` - Mermaid 转换

**操作类型**：
```typescript
type ExcalidrawOperation =
  | { operation: "replace_elements"; elements: any[] }
  | { operation: "patch_elements"; elements: any[] }
  | { operation: "delete_elements"; ids: string[] }
```

## 引擎注册表

引擎在中央注册表中注册：

```typescript
const engines = new Map([
  ["drawio", DrawioEngine],
  ["excalidraw", ExcalidrawEngine],
])

export function getEngine(id: string): DiagramEngine {
  return engines.get(id) ?? DrawioEngine
}
```
