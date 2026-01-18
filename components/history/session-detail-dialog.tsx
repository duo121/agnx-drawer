"use client"

import { Check, MessageCircle, Pencil, Trash2, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/shared/utils"

interface SessionDetailDialogProps {
    isOpen: boolean
    session: {
        id: string
        title: string
        updatedAt: number
        thumbnailDataUrl?: string
        activeEngineId?: string
        hasDrawio?: boolean
        hasExcalidraw?: boolean
        messageCount?: number
    } | null
    isCurrentSession: boolean
    onClose: () => void
    onSwitch: () => void
    onDelete: () => void
    onRename: (newTitle: string) => void
    portalTarget?: HTMLElement | null
}

// 格式化相对时间
function formatRelativeTime(timestamp?: number): string {
    if (!timestamp) return ""

    const now = Date.now()
    const diff = now - timestamp
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (seconds < 60) {
        return "刚刚"
    } else if (minutes < 60) {
        return `${minutes} 分钟前`
    } else if (hours < 24) {
        return `${hours} 小时前`
    } else if (days === 1) {
        return "昨天"
    } else if (days < 7) {
        return `${days} 天前`
    } else {
        const date = new Date(timestamp)
        return date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
        })
    }
}

export function SessionDetailDialog({
    isOpen,
    session,
    isCurrentSession,
    onClose,
    onSwitch,
    onDelete,
    onRename,
    portalTarget,
}: SessionDetailDialogProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [editedTitle, setEditedTitle] = useState("")
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    // 当 session 改变时更新标题
    useEffect(() => {
        if (session) {
            setEditedTitle(session.title || "New Chat")
        }
    }, [session])

    // 当进入编辑模式时聚焦输入框
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    // 关闭弹框时重置状态
    useEffect(() => {
        if (!isOpen) {
            setIsEditing(false)
            setShowDeleteConfirm(false)
        }
    }, [isOpen])

    if (!isOpen || !session) return null

    const handleSaveTitle = () => {
        const trimmedTitle = editedTitle.trim()
        if (trimmedTitle && trimmedTitle !== session.title) {
            onRename(trimmedTitle)
        }
        setIsEditing(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            handleSaveTitle()
        } else if (e.key === "Escape") {
            setEditedTitle(session.title || "New Chat")
            setIsEditing(false)
        }
    }

    const handleDelete = () => {
        onDelete()
        onClose()
    }

    const handleSwitch = () => {
        onSwitch()
        onClose()
    }

    const useRelativePositioning = !!portalTarget

    const dialogContent = (
        <div
            className={`${useRelativePositioning ? "absolute" : "fixed"} inset-0 z-50 flex items-center justify-center pointer-events-none`}
        >
            {/* 遮罩层 */}
            <div
                className="absolute inset-0 bg-black/50 animate-in fade-in-0 pointer-events-auto"
                onClick={onClose}
            />
            {/* 对话框内容 */}
            <div className="relative w-full max-w-md mx-4 bg-muted border-2 border-border rounded-lg shadow-lg animate-in fade-in-0 zoom-in-95 pointer-events-auto overflow-hidden">
                {/* 头部 - 缩略图预览 */}
                <div className="relative h-40 bg-muted">
                    {session.thumbnailDataUrl ? (
                        <img
                            src={session.thumbnailDataUrl}
                            alt={session.title}
                            className="w-full h-full object-contain"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            无预览
                        </div>
                    )}
                    {/* 引擎图标徽章：显示会话包含的引擎 */}
                    <div className="absolute top-3 left-3 flex gap-1">
                        {session.hasDrawio && (
                            <div className="rounded-full px-2 py-1 text-xs font-medium flex items-center gap-1 bg-blue-500 text-white">
                                <svg
                                    className="h-3 w-3"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <rect x="3" y="3" width="7" height="7" rx="1" />
                                    <rect x="14" y="3" width="7" height="7" rx="1" />
                                    <rect x="3" y="14" width="7" height="7" rx="1" />
                                    <rect x="14" y="14" width="7" height="7" rx="1" />
                                </svg>
                                <span>Draw.io</span>
                            </div>
                        )}
                        {session.hasExcalidraw && (
                            <div className="rounded-full px-2 py-1 text-xs font-medium flex items-center gap-1 bg-purple-500 text-white">
                                <svg
                                    className="h-3 w-3"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M3 17.5l5-5 4 4 6-6" />
                                    <polyline points="16,12 18,10 22,6" />
                                </svg>
                                <span>Excalidraw</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 内容区域 */}
                <div className="p-4 space-y-4">
                    {/* 标题 - 可编辑 */}
                    <div className="space-y-1">
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    ref={inputRef}
                                    value={editedTitle}
                                    onChange={(e) =>
                                        setEditedTitle(e.target.value)
                                    }
                                    onKeyDown={handleKeyDown}
                                    onBlur={handleSaveTitle}
                                    className="text-lg font-semibold h-9"
                                    maxLength={100}
                                />
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleSaveTitle}
                                    className="h-9 w-9 p-0"
                                >
                                    <Check className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 group">
                                <h2 className="text-lg font-semibold flex-1 truncate">
                                    {session.title || "New Chat"}
                                </h2>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setIsEditing(true)}
                                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* 会话信息 */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                            <MessageCircle className="h-4 w-4" />
                            <span>{session.messageCount ?? 0} 轮对话</span>
                        </div>
                        <span>•</span>
                        <span>{formatRelativeTime(session.updatedAt)}</span>
                    </div>

                    {/* 当前会话标识 */}
                    {isCurrentSession && (
                        <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 rounded-lg px-3 py-2">
                            <Check className="h-4 w-4" />
                            <span>当前会话</span>
                        </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex gap-2 pt-2">
                        {!isCurrentSession && (
                            <Button className="flex-1" onClick={handleSwitch}>
                                切换到此会话
                            </Button>
                        )}
                        {showDeleteConfirm ? (
                            <div className="flex-1 flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setShowDeleteConfirm(false)}
                                >
                                    取消
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="flex-1"
                                    onClick={handleDelete}
                                    disabled={isCurrentSession}
                                >
                                    确认删除
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                className={cn(
                                    "gap-2",
                                    isCurrentSession && "flex-1",
                                )}
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={isCurrentSession}
                            >
                                <Trash2 className="h-4 w-4" />
                                {isCurrentSession ? "无法删除当前会话" : "删除"}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )

    if (portalTarget) {
        return createPortal(dialogContent, portalTarget)
    }

    return createPortal(dialogContent, document.body)
}
