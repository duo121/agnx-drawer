"use client"

import { useMemo, useRef } from "react"
import type { UIMessage } from "ai"
import { toPng } from "html-to-image"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/shared/utils"

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

function buildMarkdown(messages: UIMessage[]): string {
    return messages
        .map((m) => {
            const roleLabel =
                m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : "System"
            const text = getMessageText(m)
            return `**${roleLabel}:**\n\n${text}`
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
                backgroundColor: darkMode ? "#020617" : "#f9fafb",
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
                backgroundColor: darkMode ? "#020617" : "#f9fafb",
            })
            const res = await fetch(dataUrl)
            const blob = await res.blob()
            // Clipboard API may not be available in all environments
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>分享预览</DialogTitle>
                </DialogHeader>
                <div className="max-h-[420px] overflow-auto py-2">
                    {hasSelection ? (
                        <div
                            ref={previewRef}
                            className={cn(
                                "mx-auto w-[360px] rounded-3xl border shadow-lg overflow-hidden",
                                darkMode
                                    ? "bg-[#020617] text-slate-50 border-white/10"
                                    : "bg-white text-slate-900 border-slate-200",
                            )}
                        >
                            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
                                    AI
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-semibold">AI-Drawer</span>
                                    <span className="text-[11px] opacity-70">
                                        分享 {selectedMessages.length} 条对话
                                    </span>
                                </div>
                            </div>
                            <div className="px-4 py-4 space-y-3 text-sm">
                                {selectedMessages.map((m) => {
                                    const text = getMessageText(m)
                                    if (!text.trim()) return null
                                    const isUser = m.role === "user"
                                    return (
                                        <div
                                            key={m.id}
                                            className={cn(
                                                "flex w-full",
                                                isUser ? "justify-end" : "justify-start",
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "max-w-[80%] rounded-2xl px-3 py-2 leading-relaxed whitespace-pre-wrap break-words",
                                                    isUser
                                                        ? "bg-primary text-primary-foreground rounded-br-md"
                                                        : "bg-black/5 text-slate-900 rounded-bl-md dark:bg-white/10 dark:text-slate-50",
                                                )}
                                            >
                                                {text}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            请先在对话中选择要分享的消息
                        </div>
                    )}
                </div>
                <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                        图片会跟随当前主题（{darkMode ? "深色" : "浅色"}）导出
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
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
                            variant="outline"
                            disabled={!hasSelection}
                            onClick={handleDownloadPng}
                        >
                            下载 PNG
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            disabled={!hasSelection}
                            onClick={handleCopyMarkdown}
                        >
                            复制 Markdown
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            disabled={!hasSelection}
                            onClick={handleDownloadMarkdown}
                        >
                            下载 Markdown
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
