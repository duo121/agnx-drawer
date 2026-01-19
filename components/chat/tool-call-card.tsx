"use client"

import { Download, MousePointerClick } from "lucide-react"
import type { Dispatch, SetStateAction } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { encodePlantUML } from "@/shared/script-convertor"
import { BaseToolCard } from "./tool-renderers/base-tool-card"
import { getToolContentRenderer } from "./tool-renderers/renderers"
import { getToolMetadata, isDiagramTool } from "./tool-renderers"
import type { DiagramOperation, ToolPartLike } from "./types"
import type { ExcalidrawOperation } from "@/hooks/engines"

interface ToolCallCardProps {
    part: ToolPartLike
    expandedTools: Record<string, boolean>
    setExpandedTools: Dispatch<SetStateAction<Record<string, boolean>>>
    onCopy: (callId: string, text: string, isToolCall: boolean) => void
    onReinsert?: (payload: {
        xml?: string
        code?: string
        toolName: string
        excalidrawScene?: { elements: any[]; appState?: any; files?: Record<string, any> }
        operations?: DiagramOperation[]
        excalidrawOperations?: ExcalidrawOperation[]
    }) => void
    copiedToolCallId: string | null
    copyFailedToolCallId: string | null
    dict: {
        tools: { complete: string }
        chat: { copied: string; failedToCopy: string; copyResponse: string }
    }
}

/**
 * 工具调用卡片组件
 * 使用注册表和渲染器系统来显示不同类型的工具
 */
export function ToolCallCard({
    part,
    expandedTools,
    setExpandedTools,
    onCopy,
    onReinsert,
    copiedToolCallId,
    copyFailedToolCallId,
    dict,
}: ToolCallCardProps) {
    const callId = part.toolCallId
    const { state, input, output, result } = part
    const toolName = part.type?.replace("tool-", "") || ""
    const metadata = getToolMetadata(toolName)
    
    // 视图模式状态（源码/预览）
    const [viewMode, setViewMode] = useState<"source" | "preview">("source")
    
    // 下载菜单状态（用于转换工具）
    const [showDownloadMenu, setShowDownloadMenu] = useState(false)
    const downloadMenuRef = useRef<HTMLDivElement | null>(null)
    const downloadButtonRef = useRef<HTMLButtonElement | null>(null)
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
    
    // 下载菜单点击外部关闭
    useEffect(() => {
        if (!showDownloadMenu) return
        const handleClickOutside = (e: MouseEvent) => {
            if (
                downloadMenuRef.current &&
                !downloadMenuRef.current.contains(e.target as Node) &&
                downloadButtonRef.current &&
                !downloadButtonRef.current.contains(e.target as Node)
            ) {
                setShowDownloadMenu(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [showDownloadMenu])

    // 更新下载菜单位置
    useEffect(() => {
        if (showDownloadMenu && downloadButtonRef.current) {
            const rect = downloadButtonRef.current.getBoundingClientRect()
            setMenuPosition({
                top: rect.bottom + 6,
                left: rect.right,
            })
        }
    }, [showDownloadMenu])
    
    // 合并 result/output/input 的元数据
    const meta = useMemo(() => {
        const base: any = {}
        const merged =
            typeof result === "object" && result ? { ...base, ...(result as any) } : base
        if (output && typeof output === "object") {
            Object.assign(merged, output as any)
        }
        const partAny = part as any
        if (partAny.result && typeof partAny.result === "object") {
            Object.assign(merged, partAny.result)
        }
        if (partAny.args && typeof partAny.args === "object") {
            Object.assign(merged, partAny.args)
        }
        if (input && typeof input === "object") {
            const i = input as any
            if (!merged.code && i.code) merged.code = i.code
            if (!merged.xml && i.xml) merged.xml = i.xml
            if (!merged.pngUrl && i.pngUrl) merged.pngUrl = i.pngUrl
            if (!merged.svgUrl && i.svgUrl) merged.svgUrl = i.svgUrl
            if (!merged.elements && i.elements) merged.elements = i.elements
            if (!merged.files && i.files) merged.files = i.files
        }
        return merged
    }, [part, output, result, input])
    
    // 可复制的文本内容
    const textToCopy = useMemo(() => {
        const inputObj = (input || {}) as any
        const merged = meta as any

        // For Mermaid and PlantUML, prioritize code
        if (
            toolName === "convert_mermaid_to_excalidraw" ||
            toolName === "convert_plantuml_to_drawio"
        ) {
            if (typeof merged?.code === "string" && merged.code.trim()) return merged.code
            if (typeof inputObj?.code === "string" && inputObj.code.trim()) return inputObj.code
        }

        // For Excalidraw tools, prioritize full payload
        if (
            toolName?.includes("excalidraw") &&
            toolName !== "convert_mermaid_to_excalidraw" &&
            input &&
            typeof input === "object" &&
            Object.keys(input).length > 0
        ) {
            return JSON.stringify(input, null, 2)
        }

        if (typeof merged?.code === "string" && merged.code.trim()) return merged.code
        if (typeof merged?.xml === "string" && merged.xml.trim()) return merged.xml
        if (typeof inputObj?.code === "string" && inputObj.code.trim()) return inputObj.code
        if (typeof inputObj?.xml === "string" && inputObj.xml.trim()) return inputObj.xml

        if (output && typeof output === "object") return JSON.stringify(output, null, 2)
        if (result && typeof result === "object") return JSON.stringify(result, null, 2)

        if (typeof result === "string" && result.trim()) return result
        if (typeof output === "string" && output.trim()) return output
        if (input && typeof input === "object" && Object.keys(input).length > 0) {
            return JSON.stringify(input, null, 2)
        }
        return ""
    }, [meta, input, result, output, toolName])
    
    // Excalidraw 场景数据（用于重新插入）
    const excalidrawScene = useMemo(() => {
        if (!toolName?.includes("excalidraw")) {
            return undefined
        }
        const candidates = [
            typeof result === "object" ? (result as any) : null,
            typeof output === "object" ? (output as any) : null,
            typeof meta === "object" ? (meta as any) : null,
            (meta as any)?.scene,
            (meta as any)?.data,
            typeof input === "object" ? (input as any) : null,
        ].filter(Boolean)

        for (const candidate of candidates) {
            if (candidate && Array.isArray(candidate.elements) && candidate.elements.length > 0) {
                return {
                    elements: candidate.elements,
                    appState: candidate.appState,
                    files: candidate.files,
                }
            }
        }
        return undefined
    }, [toolName, result, output, meta, input])
    
    // 预览图 URL
    const previewDataUrl = useMemo(() => {
        // 优先从 output 中获取（工具执行时固化的缩略图）
        if ((output as any)?.thumbnailDataUrl) {
            return (output as any).thumbnailDataUrl
        }
        // 对于转换工具，使用 pngUrl 或 svgUrl
        if (meta?.pngUrl) return meta.pngUrl as string
        if (meta?.svgUrl) return meta.svgUrl as string
        return undefined
    }, [output, meta])
    
    // 获取内容渲染器
    const ContentRenderer = getToolContentRenderer(toolName)
    
    // 切换视图模式
    const toggleViewMode = () => {
        setViewMode((prev) => (prev === "source" ? "preview" : "source"))
    }
    
    // 构建操作按钮
    const actionButtons = useMemo(() => {
        const buttons: React.ReactNode[] = []
        
        // 重新插入按钮 - 图表工具
        if (isDiagramTool(toolName) && onReinsert) {
            const handleReinsert = () => {
                if (toolName.includes("excalidraw")) {
                    if (toolName === "edit_excalidraw" && input?.operations) {
                        onReinsert({
                            toolName,
                            excalidrawOperations: input.operations as unknown as ExcalidrawOperation[],
                        })
                    } else if (excalidrawScene) {
                        onReinsert({
                            toolName,
                            excalidrawScene,
                            code: meta?.code as string,
                        })
                    }
                } else if (toolName.includes("drawio") || toolName.includes("plantuml")) {
                    if (toolName === "edit_drawio" && input?.operations) {
                        onReinsert({
                            xml: input.xml as string,
                            toolName,
                            operations: input.operations as DiagramOperation[],
                        })
                    } else {
                        onReinsert({
                            xml: meta?.xml as string || (input as any)?.xml,
                            code: meta?.code as string,
                            toolName,
                        })
                    }
                }
            }
            
            const hasReinsertData =
                (toolName.includes("excalidraw") && (excalidrawScene || input?.operations)) ||
                (toolName.includes("drawio") && (input?.xml || meta?.xml || input?.operations)) ||
                (toolName.includes("plantuml") && (meta?.xml || input?.xml))
            
            if (hasReinsertData) {
                buttons.push(
                    <button
                        key="reinsert"
                        type="button"
                        onClick={handleReinsert}
                        className="p-1 rounded hover:bg-muted transition-colors"
                        title="重新插入并选中"
                    >
                        <MousePointerClick className="w-4 h-4 text-muted-foreground" />
                    </button>
                )
            }
        }
        
        // 下载按钮 - 转换工具
        if (
            (toolName === "convert_plantuml_to_drawio" ||
                toolName === "convert_mermaid_to_excalidraw") &&
            (meta?.pngUrl || meta?.svgUrl || meta?.code)
        ) {
            buttons.push(
                <div key="download" className="relative">
                    <button
                        ref={downloadButtonRef}
                        type="button"
                        className="p-1 rounded hover:bg-muted transition-colors"
                        title="下载"
                        onClick={() => setShowDownloadMenu((prev) => !prev)}
                    >
                        <Download className="w-4 h-4 text-muted-foreground" />
                    </button>
                    {showDownloadMenu &&
                        typeof window !== "undefined" &&
                        createPortal(
                            <DownloadMenu
                                ref={downloadMenuRef}
                                position={menuPosition}
                                toolName={toolName}
                                meta={meta}
                            />,
                            document.body
                        )}
                </div>
            )
        }
        
        return buttons.length > 0 ? <>{buttons}</> : null
    }, [
        toolName,
        onReinsert,
        excalidrawScene,
        meta,
        input,
        showDownloadMenu,
        menuPosition,
    ])
    
    return (
        <BaseToolCard
            part={part}
            expandedTools={expandedTools}
            setExpandedTools={setExpandedTools}
            onCopy={onCopy}
            copiedToolCallId={copiedToolCallId}
            copyFailedToolCallId={copyFailedToolCallId}
            textToCopy={textToCopy}
            dict={dict}
            actionButtons={actionButtons}
            previewDataUrl={previewDataUrl}
            viewMode={viewMode}
            onToggleViewMode={metadata.supportsPreview ? toggleViewMode : undefined}
        >
            <ContentRenderer
                part={part}
                meta={meta}
                toolName={toolName}
                viewMode={viewMode}
                previewDataUrl={previewDataUrl}
            />
        </BaseToolCard>
    )
}

// 下载菜单组件
interface DownloadMenuProps {
    position: { top: number; left: number }
    toolName: string
    meta: Record<string, any>
}

const DownloadMenu = ({
    ref,
    position,
    toolName,
    meta,
}: DownloadMenuProps & { ref: React.Ref<HTMLDivElement> }) => {
    const handleDownloadPng = async () => {
        if (meta?.pngUrl) {
            window.open(meta.pngUrl as string, "_blank")
        } else if (meta?.code) {
            if (toolName.includes("plantuml")) {
                const url = await encodePlantUML(meta.code as string, { format: "png" })
                window.open(url, "_blank")
            } else if (toolName.includes("mermaid")) {
                const { buildMermaidImgUrl } = await import("@/shared/script-convertor")
                const url = await buildMermaidImgUrl(meta.code as string, { format: "png" })
                window.open(url, "_blank")
            }
        }
    }

    const handleDownloadSvg = async () => {
        if (meta?.svgUrl) {
            window.open(meta.svgUrl as string, "_blank")
        } else if (meta?.code) {
            if (toolName.includes("plantuml")) {
                const url = await encodePlantUML(meta.code as string, { format: "svg" })
                window.open(url, "_blank")
            } else if (toolName.includes("mermaid")) {
                const { buildMermaidImgUrl } = await import("@/shared/script-convertor")
                const url = await buildMermaidImgUrl(meta.code as string, { format: "svg" })
                window.open(url, "_blank")
            }
        }
    }

    return (
        <div
            ref={ref}
            className="fixed inline-flex min-w-max flex-col rounded-md border border-border bg-background shadow-lg z-9999"
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                transform: "translateX(-100%)",
            }}
        >
            <button
                type="button"
                onClick={handleDownloadPng}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted whitespace-nowrap"
            >
                下载 PNG
            </button>
            <button
                type="button"
                onClick={handleDownloadSvg}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted whitespace-nowrap"
            >
                下载 SVG
            </button>
        </div>
    )
}
