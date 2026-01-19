"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { UIMessage } from "ai"
import { toPng } from "html-to-image"
import { toast } from "sonner"
import { createPortal } from "react-dom"
import { CheckCircle, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/shared/utils"
import { getToolMetadata } from "@/components/chat/tool-renderers"
import { getAssetUrl } from "@/shared/base-path"

interface SharePreviewDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    messages: UIMessage[]
    selectedIds: string[]
    darkMode: boolean
}

// Extract plain text from a UIMessage
function getMessageText(message: UIMessage): string {
    if (!message.parts) return ""
    return message.parts
        .filter((part) => part.type === "text")
        .map((part: any) => part.text as string)
        .join("\n")
}

// Get tool parts from a message
function getToolParts(message: UIMessage): any[] {
    if (!message.parts) return []
    return message.parts.filter((part: any) => part.type?.startsWith("tool-"))
}

function buildMarkdown(messages: UIMessage[]): string {
    return messages
        .map((m) => {
            const roleLabel =
                m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : "System"
            const parts = m.parts || []
            
            // Render parts in original order
            const contentParts: string[] = []
            
            for (const part of parts) {
                // Text part
                if (part.type === "text" && (part as any).text?.trim()) {
                    contentParts.push((part as any).text.trim())
                }
                
                // Tool part - include full details
                if (part.type?.startsWith("tool-")) {
                    const p = part as any
                    const toolName = p.type?.replace("tool-", "") || ""
                    const metadata = getToolMetadata(toolName)
                    const status = p.state === "output-available" ? "✅" : p.state === "output-error" ? "❌" : "⏳"
                    
                    let toolContent = `${status} **${metadata.displayName}**`
                    
                    // Include input if available
                    if (p.input && typeof p.input === "object" && Object.keys(p.input).length > 0) {
                        // For code-based tools, show code
                        if (p.input.code) {
                            toolContent += `\n\n\`\`\`\n${p.input.code}\n\`\`\``
                        } else if (p.input.xml) {
                            toolContent += `\n\n\`\`\`xml\n${p.input.xml}\n\`\`\``
                        } else {
                            // Show JSON for other inputs
                            const inputStr = JSON.stringify(p.input, null, 2)
                            if (inputStr.length < 2000) {
                                toolContent += `\n\n\`\`\`json\n${inputStr}\n\`\`\``
                            }
                        }
                    }
                    
                    contentParts.push(toolContent)
                }
            }
            
            const content = contentParts.join("\n\n")
            return `**${roleLabel}:**\n\n${content}`
        })
        .join("\n\n---\n\n")
}

export function SharePreviewDialog({
    open,
    onOpenChange,
    messages,
    selectedIds,
    darkMode,
}: SharePreviewDialogProps) {
    const previewRef = useRef<HTMLDivElement | null>(null)
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)

    // Find the chat panel container for portal
    useEffect(() => {
        if (open) {
            const container = document.getElementById("chat-panel-container")
            setPortalContainer(container)
        }
    }, [open])

    const selectedMessages = useMemo(() => {
        if (!selectedIds.length) return [] as UIMessage[]
        const idSet = new Set(selectedIds)
        return messages.filter((m) => idSet.has(m.id))
    }, [messages, selectedIds])

    const markdown = useMemo(() => buildMarkdown(selectedMessages), [selectedMessages])

    const handleDownloadPng = async () => {
        if (!previewRef.current) return
        try {
            const dataUrl = await toPng(previewRef.current, {
                cacheBust: true,
                pixelRatio: 2,
                backgroundColor: darkMode ? "#1e293b" : "#f8fafc",
            })
            const link = document.createElement("a")
            link.href = dataUrl
            link.download = "chat-share.png"
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        } catch (error) {
            console.error("Failed to export PNG", error)
            toast.error("导出图片失败，请稍后重试")
        }
    }

    const handleCopyImage = async () => {
        if (!previewRef.current) return
        try {
            const dataUrl = await toPng(previewRef.current, {
                cacheBust: true,
                pixelRatio: 2,
                backgroundColor: darkMode ? "#1e293b" : "#f8fafc",
            })
            const res = await fetch(dataUrl)
            const blob = await res.blob()
            if ((navigator as any).clipboard && (window as any).ClipboardItem) {
                const item = new (window as any).ClipboardItem({ [blob.type]: blob })
                await (navigator as any).clipboard.write([item])
                toast.success("已复制图片到剪切板")
            } else {
                toast.error("当前环境不支持图片剪切板复制")
            }
        } catch (error) {
            console.error("Failed to copy image", error)
            toast.error("复制图片失败")
        }
    }

    const handleCopyMarkdown = async () => {
        try {
            await navigator.clipboard.writeText(markdown)
            toast.success("已复制 Markdown 到剪切板")
        } catch (error) {
            console.error("Failed to copy markdown", error)
            toast.error("复制 Markdown 失败")
        }
    }

    const handleDownloadMarkdown = () => {
        try {
            const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" })
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = "chat-share.md"
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
        } catch (error) {
            console.error("Failed to download markdown", error)
            toast.error("下载 Markdown 失败")
        }
    }

    const hasSelection = selectedMessages.length > 0

    if (!open) return null

    const dialogContent = (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => onOpenChange(false)}
            />
            {/* Dialog */}
            <div className="relative w-full max-w-lg mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90%] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h2 className="text-base font-semibold">分享预览</h2>
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="p-1 rounded-lg hover:bg-muted transition-colors"
                    >
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Preview Content */}
                <div className="flex-1 overflow-auto p-4">
                    {hasSelection ? (
                        <div
                            ref={previewRef}
                            className={cn(
                                "rounded-2xl border overflow-hidden",
                                darkMode
                                    ? "bg-slate-800 text-slate-50 border-slate-700"
                                    : "bg-slate-50 text-slate-900 border-slate-200",
                            )}
                        >
                            {/* Card Header */}
                            <div
                                className={cn(
                                    "px-4 py-3 border-b flex items-center gap-3",
                                    darkMode ? "border-slate-700" : "border-slate-200",
                                )}
                            >
                                <img
                                    src={getAssetUrl("/ai-canvas-icon-color.png")}
                                    alt="AI-Drawer"
                                    className="h-9 w-9 rounded-lg"
                                />
                                <div>
                                    <div className="text-sm font-semibold">AI-Drawer</div>
                                    <div className="text-xs opacity-60">
                                        分享 {selectedMessages.length} 条对话
                                    </div>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="p-4 space-y-4">
                                {selectedMessages.map((m) => {
                                    const isUser = m.role === "user"
                                    const parts = m.parts || []
                                    const hasContent = parts.some(
                                        (p: any) => (p.type === "text" && p.text?.trim()) || p.type?.startsWith("tool-")
                                    )

                                    if (!hasContent) return null

                                    return (
                                        <div key={m.id} className="space-y-2">
                                            {/* Render parts in original order */}
                                            {parts.map((part: any, partIndex: number) => {
                                                // Text part
                                                if (part.type === "text" && part.text?.trim()) {
                                                    // Trim leading/trailing whitespace and normalize multiple newlines
                                                    const trimmedText = part.text.trim()
                                                    return (
                                                        <div
                                                            key={`${m.id}-text-${partIndex}`}
                                                            className={cn(
                                                                "flex w-full",
                                                                isUser ? "justify-end" : "justify-start",
                                                            )}
                                                        >
                                                            <div
                                                                className={cn(
                                                                    "rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words",
                                                                    isUser
                                                                        ? "bg-primary text-primary-foreground rounded-br-md max-w-[85%]"
                                                                        : cn(
                                                                              "rounded-bl-md w-full",
                                                                              darkMode
                                                                                  ? "bg-slate-700/50"
                                                                                  : "bg-white border border-slate-200",
                                                                          ),
                                                                )}
                                                            >
                                                                {trimmedText}
                                                            </div>
                                                        </div>
                                                    )
                                                }

                                                // Tool part
                                                if (part.type?.startsWith("tool-")) {
                                                    const toolCallId = part.toolCallId
                                                    const toolName = part.type?.replace("tool-", "") || ""
                                                    const metadata = getToolMetadata(toolName)
                                                    const IconComponent = metadata.icon
                                                    const isComplete = part.state === "output-available"
                                                    const previewUrl = (part.output as any)?.thumbnailDataUrl

                                                    return (
                                                        <div
                                                            key={toolCallId || `${m.id}-tool-${partIndex}`}
                                                            className={cn(
                                                                "rounded-xl border overflow-hidden",
                                                                darkMode
                                                                    ? "bg-slate-700/30 border-slate-600"
                                                                    : "bg-white border-slate-200",
                                                            )}
                                                        >
                                                            {/* Tool header */}
                                                            <div
                                                                className={cn(
                                                                    "flex items-center gap-2 px-3 py-2",
                                                                    darkMode ? "bg-slate-700/50" : "bg-slate-100",
                                                                )}
                                                            >
                                                                {IconComponent && (
                                                                    <IconComponent className="w-4 h-4 text-primary" />
                                                                )}
                                                                <span className="text-xs font-medium flex-1">
                                                                    {metadata.displayName}
                                                                </span>
                                                                {isComplete && (
                                                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                                                )}
                                                            </div>

                                                            {/* Tool preview image - always show if available */}
                                                            {previewUrl && (
                                                                <div className="p-2">
                                                                    <img
                                                                        src={previewUrl}
                                                                        alt="Preview"
                                                                        className="w-full rounded-lg"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                }

                                                return null
                                            })}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                            请先在对话中选择要分享的消息
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-border">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                            跟随主题（{darkMode ? "深色" : "浅色"}）
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                disabled={!hasSelection}
                                onClick={handleCopyMarkdown}
                            >
                                复制 MD
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                disabled={!hasSelection}
                                onClick={handleDownloadMarkdown}
                            >
                                下载 MD
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={!hasSelection}
                                onClick={handleCopyImage}
                            >
                                复制图片
                            </Button>
                            <Button
                                size="sm"
                                disabled={!hasSelection}
                                onClick={handleDownloadPng}
                            >
                                下载 PNG
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )

    // Portal into chat panel container, fallback to document.body
    return createPortal(dialogContent, portalContainer || document.body)
}
