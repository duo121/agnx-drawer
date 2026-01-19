"use client"

import { DiagramPreview } from "../components/diagram-preview"
import type { ToolContentRendererProps } from "../types"

/**
 * DSL 转换工具内容渲染器
 * 用于 convert_plantuml_to_drawio 和 convert_mermaid_to_excalidraw
 * 支持双视图：显示 DSL 代码或预览图
 */
export function ConversionRenderer({
    part,
    meta,
    viewMode,
    previewDataUrl,
}: ToolContentRendererProps) {
    const { input } = part
    
    // 预览模式：显示转换后的预览图
    if (viewMode === "preview") {
        // 优先使用传入的 previewDataUrl，否则使用 meta 中的 pngUrl/svgUrl
        const url = previewDataUrl || meta?.pngUrl || meta?.svgUrl
        return <DiagramPreview previewDataUrl={url} />
    }
    
    // 源码模式：显示 DSL 代码
    const code = meta?.code || (input as any)?.code
    
    if (!code) {
        return null
    }
    
    // PlantUML/Mermaid 代码直接显示为纯文本（不使用 CodeBlock，因为它不支持这些语言）
    return (
        <pre className="text-[11px] font-mono leading-relaxed overflow-x-auto overflow-y-auto max-h-48 text-foreground/80 bg-muted/30 rounded px-2 py-1.5 whitespace-pre-wrap break-all">
            {code}
        </pre>
    )
}
