"use client"

import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"

interface RestoreConfirmDialogProps {
    isOpen: boolean
    onClose: () => void
    onDirectRestore: () => void
    onSaveAndRestore: () => void
    onInsertAndSelect?: () => void  // 新增：插入并选中
    portalTarget?: HTMLElement | null
}

export function RestoreConfirmDialog({
    isOpen,
    onClose,
    onDirectRestore,
    onSaveAndRestore,
    onInsertAndSelect,
    portalTarget,
}: RestoreConfirmDialogProps) {
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
            <div className="relative w-full max-w-md mx-4 p-6 bg-muted border-2 border-border rounded-lg shadow-lg animate-in fade-in-0 zoom-in-95 pointer-events-auto">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <h2 className="text-lg font-semibold">恢复历史版本</h2>
                        <p className="text-sm text-muted-foreground">
                            当前画布可能有未保存的修改，请选择如何处理：
                        </p>
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="outline" onClick={onClose}>
                            取消
                        </Button>
                        {onInsertAndSelect && (
                            <Button variant="secondary" onClick={onInsertAndSelect}>
                                插入并选中
                            </Button>
                        )}
                        <Button onClick={onSaveAndRestore}>
                            保存后恢复
                        </Button>
                        <Button variant="destructive" onClick={onDirectRestore}>
                            直接恢复
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
