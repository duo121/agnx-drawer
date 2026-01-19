import { useEffect } from "react"
import {
    Download,
    ImageIcon,
    Link,
    Maximize2,
    Save,
    Settings2,
    Share2,
} from "lucide-react"
import { ButtonWithTooltip } from "@/components/button-with-tooltip"
import { cn } from "@/shared/utils"
import type { FocusArea, ToolbarButtonConfig } from "./main"

export interface ToolboxHeaderProps {
    // 搜索
    searchQuery: string
    onSearchChange: (query: string) => void
    onKeyDown: (e: React.KeyboardEvent) => void

    // 焦点
    focusArea: FocusArea
    onFocusChange: (area: FocusArea) => void

    // 工具栏
    visibleToolbarButtons: ToolbarButtonConfig[]
    toolbarActions: Record<string, () => void>
    toolbarButtonRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>
    // 匹配的工具栏按钮索引（用于高亮显示）
    matchedToolbarIndices?: number[]

    // 工具栏 tooltip
    tooltipPosition: { left: number } | null
    setTooltipPosition: (pos: { left: number } | null) => void

    // 模型
    selectedModelName: string

    // Refs
    searchInputRef: React.RefObject<HTMLInputElement | null>
    containerRef: React.RefObject<HTMLDivElement | null>
}

// 工具栏按钮图标映射
const TOOLBAR_ICONS: Record<string, React.ReactNode> = {
    preview: <Maximize2 className="h-4 w-4" />,
    save: <Save className="h-4 w-4" />,
    export: <Download className="h-4 w-4" />,
    share: <Share2 className="h-4 w-4" />,
    upload: <ImageIcon className="h-4 w-4" />,
    url: <Link className="h-4 w-4" />,
    model: <Settings2 className="h-4 w-4" />,
}

export function ToolboxHeader({
    searchQuery,
    onSearchChange,
    onKeyDown,
    focusArea,
    onFocusChange,
    visibleToolbarButtons,
    toolbarActions,
    toolbarButtonRefs,
    matchedToolbarIndices = [],
    tooltipPosition,
    setTooltipPosition,
    selectedModelName,
    searchInputRef,
    containerRef,
}: ToolboxHeaderProps) {
    // 当 focusArea 变化时计算 tooltip 位置
    useEffect(() => {
        if (focusArea.type !== "toolbar") {
            setTooltipPosition(null)
            return
        }

        // 同步计算位置，避免闪烁
        const buttonElement = toolbarButtonRefs.current[focusArea.index]
        const containerElement = containerRef.current

        if (!buttonElement || !containerElement) return

        const buttonRect = buttonElement.getBoundingClientRect()
        const containerRect = containerElement.getBoundingClientRect()
        const leftOffset = buttonRect.left - containerRect.left + buttonRect.width / 2

        setTooltipPosition({ left: leftOffset })
    }, [focusArea, toolbarButtonRefs, containerRef, setTooltipPosition])

    const isSearchFocused = focusArea.type === "search"

    return (
        <>
            <div className="px-3 py-2 flex items-center gap-2 relative">
                {/* 搜索框 */}
                <div
                    className={cn(
                        "flex-1 flex items-center gap-2 h-9 px-3 rounded-xl bg-background border transition-colors",
                        isSearchFocused ? "border-primary ring-2 ring-primary/30" : "border-border/30"
                    )}
                >
                    <input
                        ref={searchInputRef}
                        value={searchQuery || ""}
                        onChange={(e) => onSearchChange(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder="搜索命令、技能、模型..."
                        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                    />
                </div>

                {/* 工具按钮组 */}
                <div className="flex items-center gap-0.5">
                    {visibleToolbarButtons.map((btn, idx) => {
                        const isFocused = focusArea.type === "toolbar" && focusArea.index === idx
                        // 检查是否匹配过滤词（需要检查原始索引是否在 matchedToolbarIndices 中）
                        const isMatched = matchedToolbarIndices.includes(idx)
                        return (
                            <ButtonWithTooltip
                                key={btn.key}
                                ref={(el: HTMLButtonElement | null) => {
                                    toolbarButtonRefs.current[idx] = el
                                }}
                                variant="ghost"
                                size="icon"
                                onClick={() => toolbarActions[btn.key]?.()}
                                onKeyDown={onKeyDown}
                                tooltipContent={btn.tooltip}
                                className={cn(
                                    "h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted",
                                    isFocused && "ring-2 ring-primary text-foreground",
                                    // 匹配过滤词时高亮显示
                                    isMatched && !isFocused && "bg-primary/10 text-primary border border-primary/30"
                                )}
                            >
                                {TOOLBAR_ICONS[btn.key]}
                            </ButtonWithTooltip>
                        )
                    })}

                    {/* 模型徽章 */}
                    <div className="h-7 px-2.5 flex items-center gap-1 text-xs text-foreground bg-background border border-border/30 rounded-lg ml-1">
                        <span className="truncate max-w-24">{selectedModelName}</span>
                    </div>
                </div>
            </div>

            {/* 工具栏聚焦 tooltip */}
            {focusArea.type === "toolbar" && tooltipPosition && (
                <div
                    className="absolute pointer-events-none z-50"
                    style={{
                        bottom: "calc(100% + 8px)",
                        left: `${tooltipPosition.left}px`,
                        transform: "translateX(-50%)",
                    }}
                >
                    <div className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs whitespace-nowrap shadow-lg relative">
                        {visibleToolbarButtons[focusArea.index]?.tooltip}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-primary" />
                    </div>
                </div>
            )}
        </>
    )
}
