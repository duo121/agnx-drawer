"use client"

import { Minus, Plus, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import { useEngine } from "@/hooks/engines/engine-context"
import { ButtonWithTooltip } from "@/components/button-with-tooltip"
import { RestoreConfirmDialog } from "./restore-confirm-dialog"
import { DeleteConfirmDialog } from "./delete-confirm-dialog"

interface VersionHistoryListProps {
    onClose: () => void
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
        return "just now"
    } else if (minutes < 60) {
        return `${minutes}m`
    } else if (hours < 24) {
        return `${hours}h`
    } else if (days === 1) {
        return "yesterday"
    } else if (days < 7) {
        return `${days}d`
    } else {
        const date = new Date(timestamp)
        return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    }
}

// 缩放级别配置：每行显示的数量
const ZOOM_LEVELS = [8, 6, 4, 3, 2, 1] // 对应滑块位置 0-5

export function VersionHistoryList({ onClose }: VersionHistoryListProps) {
    const {
        engineId,
        // Excalidraw
        excalidrawHistory,
        pushExcalidrawHistory,
        deleteExcalidrawVersion,
        getExcalidrawScene,
        setExcalidrawScene,
        appendExcalidrawElements,
        // DrawIO
        diagramHistory,
        pushDrawioHistory,
        deleteDrawioHistory,
        loadDiagram,
        latestSvg,
        chartXML,
        // 画布变化通知
        notifyCanvasChange,
    } = useEngine()

    const isExcalidraw = engineId === "excalidraw"

    // 状态
    const [zoomLevel, setZoomLevel] = useState(3) // 默认 3 (3列)

    // 恢复确认对话框状态
    const [restoreDialog, setRestoreDialog] = useState<{
        isOpen: boolean
        versionIndex: number
    }>({
        isOpen: false,
        versionIndex: -1,
    })

    // 删除确认对话框状态
    const [deleteDialog, setDeleteDialog] = useState<{
        isOpen: boolean
        versionIndex: number
    }>({
        isOpen: false,
        versionIndex: -1,
    })

    // refs
    const containerRef = useRef<HTMLDivElement>(null)
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

    // 查找 ChatPanel 容器作为 Portal 目标
    const findPortalTarget = useCallback(() => {
        if (!containerRef.current) return null
        // 从当前元素向上查找，找到带有 relative 定位的容器
        let el = containerRef.current.parentElement
        while (el) {
            const styles = window.getComputedStyle(el)
            // 找到第一个 position: relative 的容器
            if (styles.position === 'relative' && el.classList.contains('flex-col')) {
                return el
            }
            el = el.parentElement
        }
        return null
    }, [])

    // 初始化 portal 目标
    const updatePortalTarget = useCallback(() => {
        setPortalTarget(findPortalTarget())
    }, [findPortalTarget])

    // 短轮询确保找到容器
    const initPortalTarget = useCallback(() => {
        updatePortalTarget()
        let attempts = 0
        const interval = setInterval(() => {
            const target = findPortalTarget()
            if (target || attempts > 10) {
                clearInterval(interval)
                if (target) setPortalTarget(target)
            }
            attempts++
        }, 50)
        return () => clearInterval(interval)
    }, [findPortalTarget, updatePortalTarget])

    // 初始化 portal 目标
    useEffect(initPortalTarget, [initPortalTarget])

    // 关闭历史版本栏
    const handleClose = useCallback(() => {
        onClose()
    }, [onClose])

    // 点击外部关闭历史版本栏
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent | TouchEvent) => {
            const target = e.target as Node
            if (containerRef.current && !containerRef.current.contains(target)) {
                handleClose()
            }
        }

        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside)
            document.addEventListener('touchstart', handleClickOutside)
        }, 0)

        return () => {
            clearTimeout(timer)
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('touchstart', handleClickOutside)
        }
    }, [handleClose])

    // 手动保存历史版本
    const handleSaveVersion = async () => {
        if (isExcalidraw) {
            const scene = getExcalidrawScene()
            if (!scene?.elements?.length) {
                toast.error("没有可保存的内容")
                return
            }
            await pushExcalidrawHistory("手动保存", true)
            toast.success("已保存历史版本")
        } else {
            // DrawIO: 使用 isRealDiagram 检查
            const { isRealDiagram } = await import("@/shared/utils")
            if (!latestSvg || !isRealDiagram(chartXML)) {
                toast.error("没有可保存的内容")
                return
            }
            pushDrawioHistory(true)
            toast.success("已保存历史版本")
        }
    }

    // 直接恢复版本
    const restoreVersion = useCallback(async (index: number) => {
        if (isExcalidraw) {
            const entry = excalidrawHistory[index]
            if (entry?.scene) {
                const baseAppState = getExcalidrawScene()?.appState || {}

                const safeScene = {
                    elements: entry.scene.elements || [],
                    appState: {
                        ...baseAppState,
                        collaborators: new Map(),
                    },
                    files: entry.scene.files || {},
                }
                // 使用 commitToHistory: true 让这次恢复可以被 Ctrl+Z 撤销
                await setExcalidrawScene(safeScene, { commitToHistory: true })
                notifyCanvasChange()
            }
        } else {
            const entry = diagramHistory[index]
            if (entry?.xml) {
                loadDiagram(entry.xml, true)
                notifyCanvasChange()
            }
        }
    }, [isExcalidraw, excalidrawHistory, diagramHistory, getExcalidrawScene, setExcalidrawScene, loadDiagram, notifyCanvasChange])

    // 保存后恢复
    const saveAndRestoreVersion = useCallback(async (index: number) => {
        // 先保存当前状态
        if (isExcalidraw) {
            const scene = getExcalidrawScene()
            if (scene?.elements?.length) {
                await pushExcalidrawHistory("手动保存", true)
            }
        } else {
            // DrawIO: 使用 isRealDiagram 检查
            const { isRealDiagram } = await import("@/shared/utils")
            if (latestSvg && isRealDiagram(chartXML)) {
                pushDrawioHistory(true)
            }
        }
        // 然后恢复选中的版本
        await restoreVersion(index)
    }, [isExcalidraw, getExcalidrawScene, pushExcalidrawHistory, latestSvg, chartXML, pushDrawioHistory, restoreVersion])

    // 点击历史版本项 - 打开恢复确认对话框
    const handleVersionClick = useCallback((index: number) => {
        setRestoreDialog({
            isOpen: true,
            versionIndex: index,
        })
    }, [])

    // 恢复确认对话框 - 直接恢复
    const handleDirectRestore = useCallback(async () => {
        const { versionIndex } = restoreDialog
        setRestoreDialog({ isOpen: false, versionIndex: -1 })
        await restoreVersion(versionIndex)
    }, [restoreDialog, restoreVersion])

    // 恢复确认对话框 - 插入并选中
    const handleInsertAndSelect = useCallback(async () => {
        const { versionIndex } = restoreDialog
        setRestoreDialog({ isOpen: false, versionIndex: -1 })
        
        if (isExcalidraw) {
            const entry = excalidrawHistory[versionIndex]
            if (entry?.scene?.elements) {
                // 使用 appendExcalidrawElements 插入元素并选中
                // 不需要传入 selectIds，函数会自动选中新插入的元素
                await appendExcalidrawElements(entry.scene.elements)
                notifyCanvasChange()
            }
        } else {
            // DrawIO 不支持插入，降级为直接恢复
            await restoreVersion(versionIndex)
        }
    }, [restoreDialog, isExcalidraw, excalidrawHistory, appendExcalidrawElements, restoreVersion, notifyCanvasChange])

    // 恢复确认对话框 - 保存后恢复
    const handleSaveAndRestore = useCallback(async () => {
        const { versionIndex } = restoreDialog
        setRestoreDialog({ isOpen: false, versionIndex: -1 })
        await saveAndRestoreVersion(versionIndex)
    }, [restoreDialog, saveAndRestoreVersion])

    // 恢复确认对话框 - 取消
    const handleCancelRestore = useCallback(() => {
        setRestoreDialog({ isOpen: false, versionIndex: -1 })
    }, [])

    // 点击删除按钮 - 打开删除确认对话框
    const handleDeleteClick = useCallback((e: React.MouseEvent, index: number) => {
        e.stopPropagation()
        setDeleteDialog({
            isOpen: true,
            versionIndex: index,
        })
    }, [])

    // 删除确认对话框 - 确认删除
    const handleConfirmDelete = useCallback(() => {
        const { versionIndex } = deleteDialog
        setDeleteDialog({ isOpen: false, versionIndex: -1 })
        
        if (isExcalidraw) {
            deleteExcalidrawVersion(versionIndex)
        } else {
            deleteDrawioHistory(versionIndex)
        }
        toast.success("已删除版本")
    }, [deleteDialog, isExcalidraw, deleteExcalidrawVersion, deleteDrawioHistory])

    // 删除确认对话框 - 取消
    const handleCancelDelete = useCallback(() => {
        setDeleteDialog({ isOpen: false, versionIndex: -1 })
    }, [])

    const historyItems = isExcalidraw ? excalidrawHistory : diagramHistory
    const hasItems = historyItems.length > 0
    const itemsPerRow = ZOOM_LEVELS[zoomLevel]

    // 计算图片尺寸（正方形）
    // 根据每行数量计算百分比宽度
    const getItemStyle = () => {
        // gap 是 12px，需要减去 (itemsPerRow - 1) * gap 的空间
        const gapTotal = (itemsPerRow - 1) * 12
        const widthPercent = `calc((100% - ${gapTotal}px) / ${itemsPerRow})`
        return {
            width: widthPercent,
            aspectRatio: '1 / 1', // 确保正方形
        }
    }

    const itemStyle = getItemStyle()

    // 遮罩层 - 覆盖 header + main，防止误触
    const overlayContent = portalTarget && createPortal(
        <div
            className="absolute inset-0 bottom-auto bg-background/50 z-30 pointer-events-auto"
            style={{
                height: `calc(100% - ${portalTarget.querySelector('footer')?.offsetHeight || 0}px)`
            }}
        />,
        portalTarget
    )

    // 面板内容
    const panelContent = (
        <div className="flex flex-col h-full">
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30 shrink-0">
                <span className="text-sm font-medium text-foreground">历史版本</span>

                <div className="flex items-center gap-2">
                    {/* 缩小按钮 */}
                    <ButtonWithTooltip
                        variant="ghost"
                        size="icon"
                        onClick={() => setZoomLevel(Math.max(0, zoomLevel - 1))}
                        disabled={zoomLevel === 0}
                        tooltipContent="缩小"
                        className="h-6 w-6 p-0"
                    >
                        <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                    </ButtonWithTooltip>

                    {/* 滑块 */}
                    <input
                        type="range"
                        min={0}
                        max={ZOOM_LEVELS.length - 1}
                        value={zoomLevel}
                        onChange={(e) => setZoomLevel(Number(e.target.value))}
                        className="w-16 h-1 accent-primary cursor-pointer"
                        title="调整大小"
                    />

                    {/* 放大按钮 */}
                    <ButtonWithTooltip
                        variant="ghost"
                        size="icon"
                        onClick={() => setZoomLevel(Math.min(ZOOM_LEVELS.length - 1, zoomLevel + 1))}
                        disabled={zoomLevel === ZOOM_LEVELS.length - 1}
                        tooltipContent="放大"
                        className="h-6 w-6 p-0"
                    >
                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                    </ButtonWithTooltip>

                    {/* 关闭按钮 */}
                    <ButtonWithTooltip
                        variant="ghost"
                        size="icon"
                        onClick={handleClose}
                        tooltipContent="关闭"
                        className="h-7 w-7 p-0"
                    >
                        <X className="h-4 w-4 text-muted-foreground" />
                    </ButtonWithTooltip>
                </div>
            </div>

            {/* 历史版本列表 */}
            <div className="p-3 pb-6 overflow-y-auto flex-1">
                <div className="flex flex-wrap gap-3 content-start">
                    {isExcalidraw ? (
                        // Excalidraw 历史
                        excalidrawHistory.map((item, index) => (
                            <VersionItem
                                key={item.timestamp}
                                thumbnailUrl={item.thumbnailDataUrl}
                                label={formatRelativeTime(item.timestamp)}
                                isManual={item.isManual}
                                style={itemStyle}
                                onClick={() => handleVersionClick(index)}
                                onDelete={(e) => handleDeleteClick(e, index)}
                            />
                        ))
                    ) : (
                        // DrawIO 历史
                        diagramHistory.map((item, index) => (
                            <VersionItem
                                key={item.timestamp || index}
                                thumbnailUrl={item.svg}
                                label={item.timestamp ? formatRelativeTime(item.timestamp) : `v${index + 1}`}
                                isManual={item.isManual}
                                style={itemStyle}
                                onClick={() => handleVersionClick(index)}
                                onDelete={(e) => handleDeleteClick(e, index)}
                            />
                        ))
                    )}

                    {/* 添加保存按钮 */}
                    <AddSaveButton onClick={handleSaveVersion} style={itemStyle} />

                    {/* 空状态 */}
                    {!hasItems && (
                        <div className="flex-1 text-center text-sm text-muted-foreground py-4 w-full">
                            暂无历史版本，点击 + 按钮保存当前状态
                        </div>
                    )}
                </div>
            </div>
        </div>
    )

    // 渲染到 Portal 或直接渲染
    if (portalTarget) {
        return (
            <>
                {overlayContent}
                {createPortal(
                    <div
                        ref={containerRef}
                        className="absolute left-4 right-4 top-4 bg-background border border-border rounded-xl shadow-lg z-40 overflow-hidden flex flex-col"
                        style={{
                            height: `calc(100% - ${(portalTarget.querySelector('footer')?.offsetHeight || 0) + 24}px)`
                        }}
                    >
                        {panelContent}
                    </div>,
                    portalTarget
                )}
                {/* 恢复确认对话框 */}
                <RestoreConfirmDialog
                    isOpen={restoreDialog.isOpen}
                    onClose={handleCancelRestore}
                    onDirectRestore={handleDirectRestore}
                    onSaveAndRestore={handleSaveAndRestore}
                    onInsertAndSelect={isExcalidraw ? handleInsertAndSelect : undefined}
                    portalTarget={portalTarget}
                />
                {/* 删除确认对话框 */}
                <DeleteConfirmDialog
                    isOpen={deleteDialog.isOpen}
                    onClose={handleCancelDelete}
                    onConfirm={handleConfirmDelete}
                    portalTarget={portalTarget}
                />
            </>
        )
    }

    // 降级：直接渲染（在输入框上方）
    return (
        <>
            <div
                ref={containerRef}
                className="absolute left-0 right-0 bottom-full mb-2 bg-background border border-border rounded-xl shadow-lg z-40 overflow-hidden"
                style={{ maxHeight: '400px' }}
            >
                {panelContent}
            </div>
            {/* 恢复确认对话框 */}
            <RestoreConfirmDialog
                isOpen={restoreDialog.isOpen}
                onClose={handleCancelRestore}
                onDirectRestore={handleDirectRestore}
                onSaveAndRestore={handleSaveAndRestore}
                onInsertAndSelect={isExcalidraw ? handleInsertAndSelect : undefined}
            />
            {/* 删除确认对话框 */}
            <DeleteConfirmDialog
                isOpen={deleteDialog.isOpen}
                onClose={handleCancelDelete}
                onConfirm={handleConfirmDelete}
            />
        </>
    )
}

// 添加保存按钮
interface AddSaveButtonProps {
    onClick: () => void
    style: React.CSSProperties
}

function AddSaveButton({ onClick, style }: AddSaveButtonProps) {
    return (
        <div
            className="relative group shrink-0 cursor-pointer rounded-xl transition-all hover:ring-2 hover:ring-primary/50 hover:ring-offset-1 hover:ring-offset-background border-2 border-dashed border-muted-foreground/30 hover:border-primary flex items-center justify-center hover:bg-primary/5"
            onClick={onClick}
            style={style}
            title="保存当前版本"
        >
            <Plus className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
    )
}

// 单个历史版本项
interface VersionItemProps {
    thumbnailUrl?: string
    label: string
    isManual?: boolean
    style: React.CSSProperties
    onClick: () => void
    onDelete?: (e: React.MouseEvent) => void
}

function VersionItem({ thumbnailUrl, label, isManual, style, onClick, onDelete }: VersionItemProps) {
    return (
        <div
            className={`relative group shrink-0 cursor-pointer rounded-xl transition-all ${
                isManual
                    ? "ring-2 ring-green-500 ring-offset-1 ring-offset-background"
                    : ""
            }`}
            onClick={onClick}
            style={style}
        >
            <div className="w-full h-full border border-border rounded-xl overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center hover:border-primary transition-colors">
                {thumbnailUrl ? (
                    <img src={thumbnailUrl} alt={label} className="object-contain w-full h-full p-0.5 rounded-lg" />
                ) : (
                    <span className="text-xs text-muted-foreground">无预览</span>
                )}
            </div>

            {/* 时间标签 */}
            <div className="absolute -bottom-5 left-0 right-0 text-center">
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{label}</span>
            </div>

            {/* 删除按钮 */}
            {onDelete && (
                <button
                    type="button"
                    onClick={onDelete}
                    className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm w-4 h-4 flex items-center justify-center"
                    title="删除版本"
                >
                    <X className="h-3 w-3" />
                </button>
            )}
        </div>
    )
}
