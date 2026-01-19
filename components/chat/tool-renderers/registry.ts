/**
 * 工具 UI 注册表
 * 管理所有工具的 UI 配置
 */

import {
    Cpu,
    FileText,
    FileEdit,
    Terminal,
    ArrowLeftRight,
    Image,
    Pencil,
    Plus,
    GitBranch,
} from "lucide-react"
import type { ToolUIConfig, ToolUIMetadata } from "./types"

/**
 * 工具 UI 注册表
 * key: 工具名称
 * value: 工具 UI 配置
 */
const toolUIRegistry = new Map<string, ToolUIConfig>()

/**
 * 默认工具元数据
 */
const defaultMetadata: ToolUIMetadata = {
    id: "unknown",
    displayName: "Tool",
    icon: Cpu,
    category: "system",
    supportsPreview: false,
}

/**
 * 预定义的工具元数据
 */
const builtinToolMetadata: Record<string, ToolUIMetadata> = {
    // DrawIO 图表工具
    display_drawio: {
        id: "display_drawio",
        displayName: "Generate Diagram",
        icon: Image,
        category: "diagram",
        engine: "drawio",
        supportsPreview: true,
    },
    edit_drawio: {
        id: "edit_drawio",
        displayName: "Edit Diagram",
        icon: Pencil,
        category: "diagram",
        engine: "drawio",
        supportsPreview: true,
    },
    append_drawio: {
        id: "append_drawio",
        displayName: "Append Diagram",
        icon: Plus,
        category: "diagram",
        engine: "drawio",
        supportsPreview: true,
    },
    
    // Excalidraw 图表工具
    display_excalidraw: {
        id: "display_excalidraw",
        displayName: "Generate Diagram",
        icon: Image,
        category: "diagram",
        engine: "excalidraw",
        supportsPreview: true,
    },
    edit_excalidraw: {
        id: "edit_excalidraw",
        displayName: "Edit Diagram",
        icon: Pencil,
        category: "diagram",
        engine: "excalidraw",
        supportsPreview: true,
    },
    append_excalidraw: {
        id: "append_excalidraw",
        displayName: "Append Diagram",
        icon: Plus,
        category: "diagram",
        engine: "excalidraw",
        supportsPreview: true,
    },
    
    // 转换工具
    convert_plantuml_to_drawio: {
        id: "convert_plantuml_to_drawio",
        displayName: "PlantUML → Draw.io",
        icon: GitBranch,
        category: "conversion",
        engine: "drawio",
        supportsPreview: true,
    },
    convert_mermaid_to_excalidraw: {
        id: "convert_mermaid_to_excalidraw",
        displayName: "Mermaid → Excalidraw",
        icon: GitBranch,
        category: "conversion",
        engine: "excalidraw",
        supportsPreview: true,
    },
    
    // 文件工具
    read_file: {
        id: "read_file",
        displayName: "Read File",
        icon: FileText,
        category: "file",
        supportsPreview: false,
    },
    write_file: {
        id: "write_file",
        displayName: "Write File",
        icon: FileEdit,
        category: "file",
        supportsPreview: false,
    },
    
    // 系统工具
    bash: {
        id: "bash",
        displayName: "Execute Command",
        icon: Terminal,
        category: "system",
        supportsPreview: false,
    },
    switch_canvas: {
        id: "switch_canvas",
        displayName: "Switch Canvas",
        icon: ArrowLeftRight,
        category: "system",
        supportsPreview: false,
    },
}

/**
 * 注册工具 UI 配置
 */
export function registerToolUI(config: ToolUIConfig): void {
    toolUIRegistry.set(config.metadata.id, config)
}

/**
 * 获取工具 UI 配置
 */
export function getToolUIConfig(toolName: string): ToolUIConfig | undefined {
    return toolUIRegistry.get(toolName)
}

/**
 * 获取工具元数据
 */
export function getToolMetadata(toolName: string): ToolUIMetadata {
    // 先从注册表查找
    const config = toolUIRegistry.get(toolName)
    if (config) {
        return config.metadata
    }
    
    // 再从内置元数据查找
    const builtin = builtinToolMetadata[toolName]
    if (builtin) {
        return builtin
    }
    
    // 返回默认元数据，使用工具名作为显示名
    return {
        ...defaultMetadata,
        id: toolName,
        displayName: toolName,
    }
}

/**
 * 获取工具显示名称（便捷方法）
 */
export function getToolDisplayName(toolName: string): string {
    return getToolMetadata(toolName).displayName
}

/**
 * 判断工具是否支持预览
 */
export function toolSupportsPreview(toolName: string): boolean {
    return getToolMetadata(toolName).supportsPreview ?? false
}

/**
 * 判断是否为图表工具
 */
export function isDiagramTool(toolName: string): boolean {
    const metadata = getToolMetadata(toolName)
    return metadata.category === "diagram" || metadata.category === "conversion"
}

/**
 * 获取工具所属引擎
 */
export function getToolEngine(toolName: string): "drawio" | "excalidraw" | undefined {
    return getToolMetadata(toolName).engine
}

/**
 * 初始化内置工具的 UI 配置
 * 在应用启动时调用
 */
export function initBuiltinToolUI(): void {
    // 为所有内置工具创建基本配置
    for (const [id, metadata] of Object.entries(builtinToolMetadata)) {
        if (!toolUIRegistry.has(id)) {
            toolUIRegistry.set(id, { metadata })
        }
    }
}

// 自动初始化
initBuiltinToolUI()
