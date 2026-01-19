"use client"

import {
    AlertTriangle,
    Check,
    CheckCircle,
    ChevronDown,
    ChevronUp,
    Copy,
    Eye,
    EyeOff,
    XCircle,
} from "lucide-react"
import type { Dispatch, ReactNode, SetStateAction } from "react"
import { useState } from "react"
import { getToolMetadata, toolSupportsPreview } from "./registry"
import type { ToolPartLike } from "../types"
import { isMxCellXmlComplete } from "@/shared/utils"

interface BaseToolCardProps {
    /** 工具调用数据 */
    part: ToolPartLike
    /** 展开状态管理 */
    expandedTools: Record<string, boolean>
    setExpandedTools: Dispatch<SetStateAction<Record<string, boolean>>>
    /** 复制相关 */
    onCopy?: (callId: string, text: string, isToolCall: boolean) => void
    copiedToolCallId?: string | null
    copyFailedToolCallId?: string | null
    /** 可复制的文本内容 */
    textToCopy?: string
    /** 国际化文案 */
    dict: {
        tools: { complete: string }
        chat: { copied: string; failedToCopy: string; copyResponse: string }
    }
    /** 操作按钮区域（在复制按钮之后、状态图标之前） */
    actionButtons?: ReactNode
    /** 内容区域 */
    children?: ReactNode
    /** 预览图 URL */
    previewDataUrl?: string
    /** 视图模式 */
    viewMode?: "source" | "preview"
    /** 切换视图模式回调 */
    onToggleViewMode?: () => void
}

/**
 * 通用工具卡片组件
 * 提供统一的卡片壳：header、展开/收起、状态图标等
 */
export function BaseToolCard({
    part,
    expandedTools,
    setExpandedTools,
    onCopy,
    copiedToolCallId,
    copyFailedToolCallId,
    textToCopy,
    dict,
    actionButtons,
    children,
    previewDataUrl,
    viewMode = "source",
    onToggleViewMode,
}: BaseToolCardProps) {
    const callId = part.toolCallId
    const { state, input } = part
    const toolName = part.type?.replace("tool-", "") || ""
    
    // 从注册表获取元数据
    const metadata = getToolMetadata(toolName)
    const supportsPreview = toolSupportsPreview(toolName)
    const IconComponent = metadata.icon
    
    // 展开状态：默认完成时收起，流式时展开
    const isExpanded = expandedTools[callId] ?? state !== "output-available"
    const isCopied = copiedToolCallId === callId
    const hasCopyableContent = Boolean(textToCopy?.trim())
    const hasPreview = Boolean(previewDataUrl)
    
    const toggleExpanded = () => {
        setExpandedTools((prev) => ({
            ...prev,
            [callId]: !isExpanded,
        }))
    }
    
    const handleCopy = () => {
        if (hasCopyableContent && textToCopy && onCopy) {
            onCopy(callId, textToCopy, true)
        }
    }
    
    // 判断是否为截断错误
    const isTruncated =
        state === "output-error" &&
        (toolName === "display_drawio" || toolName === "append_drawio") &&
        !isMxCellXmlComplete(input?.xml)

    return (
        <div className="my-3 rounded-xl border border-border/60 bg-muted/30 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/50">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                        {IconComponent && (
                            <IconComponent className="w-3.5 h-3.5 text-primary" />
                        )}
                    </div>
                    <span className="text-sm font-medium text-foreground/80">
                        {metadata.displayName}
                    </span>
                </div>
                
                <div className="flex items-center gap-2">
                    {/* 复制按钮 */}
                    {hasCopyableContent && onCopy && (
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="p-1 rounded hover:bg-muted transition-colors"
                            title={
                                copiedToolCallId === callId
                                    ? dict.chat.copied
                                    : copyFailedToolCallId === callId
                                      ? dict.chat.failedToCopy
                                      : dict.chat.copyResponse
                            }
                        >
                            {isCopied ? (
                                <Check className="w-4 h-4 text-green-600" />
                            ) : (
                                <Copy className="w-4 h-4 text-muted-foreground" />
                            )}
                        </button>
                    )}
                    
                    {/* 预览切换按钮 */}
                    {supportsPreview && isExpanded && onToggleViewMode && (
                        <button
                            type="button"
                            onClick={onToggleViewMode}
                            className={`p-1 rounded transition-colors ${
                                viewMode === "preview"
                                    ? "bg-primary/20 text-primary"
                                    : "hover:bg-muted text-muted-foreground"
                            }`}
                            title={viewMode === "source" ? "Show Preview" : "Show Source"}
                        >
                            {viewMode === "preview" ? (
                                <EyeOff className="w-4 h-4" />
                            ) : (
                                <Eye className="w-4 h-4" />
                            )}
                        </button>
                    )}
                    
                    {/* 自定义操作按钮 */}
                    {actionButtons}
                    
                    {/* 状态图标 */}
                    {state === "input-streaming" && (
                        <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    )}
                    {state === "output-available" && (
                        <span title={dict.tools.complete}>
                            <CheckCircle className="w-4 h-4 text-green-600" aria-hidden />
                        </span>
                    )}
                    {state === "output-error" && (
                        <span title={isTruncated ? "Truncated" : "Error"}>
                            {isTruncated ? (
                                <AlertTriangle className="w-4 h-4 text-yellow-600" aria-hidden />
                            ) : (
                                <XCircle className="w-4 h-4 text-red-600" aria-hidden />
                            )}
                        </span>
                    )}
                    
                    {/* 展开/收起按钮 */}
                    {input && Object.keys(input).length > 0 && (
                        <button
                            type="button"
                            onClick={toggleExpanded}
                            className="p-1 rounded hover:bg-muted transition-colors"
                        >
                            {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                        </button>
                    )}
                </div>
            </div>
            
            {/* 内容区域 */}
            {isExpanded && children && (
                <div className="px-4 py-3 border-t border-border/40 bg-muted/20">
                    {children}
                </div>
            )}
        </div>
    )
}
