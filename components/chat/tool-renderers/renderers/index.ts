/**
 * 工具内容渲染器
 */

export { DefaultRenderer } from "./default-renderer"
export { DiagramRenderer } from "./diagram-renderer"
export { FileRenderer } from "./file-renderer"
export { BashRenderer } from "./bash-renderer"
export { ConversionRenderer } from "./conversion-renderer"
export { SystemRenderer } from "./system-renderer"

import type { ToolContentRenderer, ToolContentRendererProps } from "../types"
import { getToolMetadata } from "../registry"
import { DefaultRenderer } from "./default-renderer"
import { DiagramRenderer } from "./diagram-renderer"
import { FileRenderer } from "./file-renderer"
import { BashRenderer } from "./bash-renderer"
import { ConversionRenderer } from "./conversion-renderer"
import { SystemRenderer } from "./system-renderer"

/**
 * 根据工具名称获取对应的内容渲染器
 */
export function getToolContentRenderer(toolName: string): ToolContentRenderer {
    const metadata = getToolMetadata(toolName)
    
    switch (metadata.category) {
        case "diagram":
            return DiagramRenderer
        case "conversion":
            return ConversionRenderer
        case "file":
            return FileRenderer
        case "system":
            if (toolName === "bash") {
                return BashRenderer
            }
            return SystemRenderer
        default:
            return DefaultRenderer
    }
}
