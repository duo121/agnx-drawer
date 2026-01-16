"use client"

import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"

interface DeleteConfirmDialogProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    portalTarget?: HTMLElement | null
}

export function DeleteConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    portalTarget,
}: DeleteConfirmDialogProps) {
    // 如果对话框未打开，不渲染任何内容
    if (!isOpen) return null

    // 如果有 portalTarget，使用相对定位（相对于容器）
    // 否则使用固定定位（相对于视口）
    const useRelativePositioning = !!portalTarget

    const dialogContent = (
        <div className={`${useRelativePositioning ? 'absolute' : 'fixed'} inset-0 z-50 flex items-center justify-center pointer-events-none`}>
            {/* 遮罩层 */}
            <div
                className="absolute inset-0 bg-black/50 animate-in fade-in-0 pointer-events-auto"
                onClick={onClose}
            />
            {/* 对话框内容 */}
            <div className="relative w-full max-w-md mx-4 p-6 bg-background border rounded-lg shadow-lg animate-in fade-in-0 zoom-in-95 pointer-events-auto">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <h2 className="text-lg font-semibold">删除历史版本</h2>
                        <p className="text-sm text-muted-foreground">
                            确定要删除这个历史版本吗？此操作无法撤销。
                        </p>
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="outline" onClick={onClose}>
                            取消
                        </Button>
                        <Button variant="destructive" onClick={onConfirm}>
                            删除
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )

    // 如果有 portalTarget，渲染到指定容器；否则渲染到 body
    if (portalTarget) {
        return createPortal(dialogContent, portalTarget)
    }

    return createPortal(dialogContent, document.body)
}
