/**
 * 工具 UI 渲染器类型定义
 */

import type { LucideIcon } from "lucide-react"
import type { DiagramOperation, ToolPartLike } from "../types"
import type { ExcalidrawOperation } from "@/hooks/engines"

/**
 * 工具分类
 */
export type ToolCategory = "diagram" | "file" | "system" | "conversion"

/**
 * 工具 UI 元数据
 * 定义工具在 UI 中的显示方式
 */
export interface ToolUIMetadata {
    /** 工具 ID，如 "display_drawio" */
    id: string
    /** 显示名称 */
    displayName: string
    /** 图标组件 */
    icon?: LucideIcon
    /** 工具分类 */
    category: ToolCategory
    /** 所属引擎（仅图表工具） */
    engine?: "drawio" | "excalidraw"
    /** 是否支持预览视图 */
    supportsPreview?: boolean
}

/**
 * 工具内容渲染器 Props
 * 用于渲染工具卡片展开后的内容区域
 */
export interface ToolContentRendererProps {
    /** 工具调用数据 */
    part: ToolPartLike
    /** 从 result/output/input 合并的元数据 */
    meta: Record<string, any>
    /** 工具名称 */
    toolName: string
    /** 当前视图模式 */
    viewMode: "source" | "preview"
    /** 预览图 URL（如果有） */
    previewDataUrl?: string
}

/**
 * 工具操作按钮渲染器 Props
 * 用于渲染工具卡片头部的操作按钮
 */
export interface ToolActionsRendererProps {
    /** 工具调用数据 */
    part: ToolPartLike
    /** 从 result/output/input 合并的元数据 */
    meta: Record<string, any>
    /** 工具名称 */
    toolName: string
    /** 重新插入回调 */
    onReinsert?: (payload: ReinsertPayload) => void
    /** 是否支持预览 */
    supportsPreview?: boolean
    /** 当前视图模式 */
    viewMode: "source" | "preview"
    /** 切换视图模式 */
    onToggleViewMode: () => void
    /** 预览图是否可用 */
    hasPreview?: boolean
}

/**
 * 重新插入回调的 payload
 */
export interface ReinsertPayload {
    xml?: string
    code?: string
    toolName: string
    excalidrawScene?: {
        elements: any[]
        appState?: any
        files?: Record<string, any>
    }
    operations?: DiagramOperation[]
    excalidrawOperations?: ExcalidrawOperation[]
}

/**
 * 工具内容渲染器组件类型
 */
export type ToolContentRenderer = React.FC<ToolContentRendererProps>

/**
 * 工具操作按钮渲染器组件类型
 */
export type ToolActionsRenderer = React.FC<ToolActionsRendererProps>

/**
 * 完整的工具 UI 配置
 */
export interface ToolUIConfig {
    /** 元数据 */
    metadata: ToolUIMetadata
    /** 内容渲染器（可选，默认使用 DefaultRenderer） */
    ContentRenderer?: ToolContentRenderer
    /** 操作按钮渲染器（可选） */
    ActionsRenderer?: ToolActionsRenderer
}
