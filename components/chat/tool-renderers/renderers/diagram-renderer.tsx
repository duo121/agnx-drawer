"use client"

import { CodeBlock } from "@/components/code-block"
import { OperationsDisplay } from "../components/operations-display"
import { DiagramPreview } from "../components/diagram-preview"
import type { ToolContentRendererProps } from "../types"
import { getToolEngine } from "../registry"

/**
 * 统一的图表工具内容渲染器
 * 支持 DrawIO 和 Excalidraw 的 display/edit/append 工具
 * 支持双视图：源码和预览
 */
export function DiagramRenderer({
    part,
    toolName,
    viewMode,
    previewDataUrl,
}: ToolContentRendererProps) {
    const { input } = part
    const engine = getToolEngine(toolName)
    
    // 预览模式
    if (viewMode === "preview") {
        return <DiagramPreview previewDataUrl={previewDataUrl} />
    }
    
    // 源码模式
    if (!input || typeof input !== "object") {
        return null
    }
    
    // DrawIO XML
    if ("xml" in input && typeof input.xml === "string") {
        return <CodeBlock code={input.xml} language="xml" />
    }
    
    // 编辑操作（DrawIO edit_drawio）
    if ("operations" in input && Array.isArray(input.operations)) {
        // DrawIO 操作
        if (engine === "drawio") {
            return <OperationsDisplay operations={input.operations} />
        }
        
        // Excalidraw 操作 - 显示为 JSON
        return <CodeBlock code={JSON.stringify(input.operations, null, 2)} language="json" />
    }
    
    // Excalidraw elements
    if ("elements" in input && Array.isArray(input.elements)) {
        return <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
    }
    
    // 其他情况：显示为 JSON
    return <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
}
