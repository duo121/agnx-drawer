"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
    usePlaceholderCarousel,
    isExampleTip,
    type TipItem,
    type ExampleTip,
} from "@/hooks/use-placeholder-carousel"
import { cn } from "@/shared/utils"

// ============ TabIcon Component ============

interface TabIconProps {
    className?: string
}

/**
 * Tab key icon component - displays a keyboard key indicator
 * Validates: Requirements 5.3
 */
export function TabIcon({ className }: TabIconProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center justify-center",
                "px-1.5 py-0.5 rounded",
                "text-[10px] font-medium leading-none",
                "bg-muted-foreground/15 text-muted-foreground/70",
                "border border-muted-foreground/20",
                "shrink-0",
                className
            )}
        >
            Tab
        </span>
    )
}

// ============ PlaceholderCarousel Component ============

interface PlaceholderCarouselProps {
    tips: TipItem[]
    isVisible: boolean
    isPaused?: boolean           // 外部控制暂停（悬浮/聚焦时）
    containerWidth?: number
    onTabFill: (tip: TipItem) => void  // 所有提示语都支持填充
    className?: string
}

/**
 * PlaceholderCarousel - Displays rotating tips in the input placeholder area
 * 
 * Features:
 * - Fade in/out animation between tips (Requirements 2.3)
 * - Horizontal scrolling for long text (Requirements 8.1, 8.2, 8.3, 8.4)
 * - Tab key to fill example tips (Requirements 4.1, 4.2, 4.3, 4.4)
 * - Tab icon display for example tips (Requirements 5.1, 5.2, 5.3)
 */
export function PlaceholderCarousel({
    tips,
    isVisible,
    isPaused: externalPaused = false,
    containerWidth = 0,
    onTabFill,
    className,
}: PlaceholderCarouselProps) {
    const {
        currentTip,
        currentIndex,
        isPaused,
        pause,
        resume,
    } = usePlaceholderCarousel({
        tips,
        interval: 3000,
        enabled: isVisible && tips.length > 0 && !externalPaused,
    })

    // Track if text needs scrolling
    const [needsScrolling, setNeedsScrolling] = useState(false)
    const textRef = useRef<HTMLSpanElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Track fade animation state
    const [isTransitioning, setIsTransitioning] = useState(false)
    const [displayedTip, setDisplayedTip] = useState<TipItem | null>(currentTip)
    const prevIndexRef = useRef(currentIndex)

    // Handle tip transition with fade animation
    useEffect(() => {
        if (currentIndex !== prevIndexRef.current) {
            setIsTransitioning(true)
            
            // After fade out, update displayed tip
            const fadeOutTimer = setTimeout(() => {
                setDisplayedTip(currentTip)
                setIsTransitioning(false)
            }, 150) // Match CSS transition duration

            prevIndexRef.current = currentIndex
            return () => clearTimeout(fadeOutTimer)
        } else {
            setDisplayedTip(currentTip)
        }
    }, [currentTip, currentIndex])

    // Check if text needs horizontal scrolling
    useEffect(() => {
        if (!textRef.current || !containerRef.current) {
            setNeedsScrolling(false)
            return
        }

        const checkScrolling = () => {
            const textWidth = textRef.current?.scrollWidth || 0
            const availableWidth = containerWidth || containerRef.current?.clientWidth || 0
            // Account for Tab icon width (~40px) and some padding
            const effectiveWidth = availableWidth - (displayedTip && isExampleTip(displayedTip) ? 50 : 10)
            setNeedsScrolling(textWidth > effectiveWidth)
        }

        checkScrolling()
        
        // Recheck on window resize
        window.addEventListener("resize", checkScrolling)
        return () => window.removeEventListener("resize", checkScrolling)
    }, [displayedTip, containerWidth])

    // Handle Tab key press
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Tab" && !e.shiftKey && isVisible && displayedTip) {
                // 所有提示语都支持 Tab 填充
                e.preventDefault()
                onTabFill(displayedTip)
            }
        },
        [isVisible, displayedTip, onTabFill]
    )

    // Attach Tab key listener
    useEffect(() => {
        if (isVisible) {
            document.addEventListener("keydown", handleKeyDown)
            return () => document.removeEventListener("keydown", handleKeyDown)
        }
    }, [isVisible, handleKeyDown])

    // Don't render if not visible or no tips
    if (!isVisible || tips.length === 0 || !displayedTip) {
        return null
    }

    const showTabIcon = true // 所有提示语都显示 Tab 图标

    return (
        <div
            ref={containerRef}
            className={cn(
                "absolute inset-0 flex items-center pointer-events-none",
                "overflow-hidden",
                className
            )}
        >
            {/* Tip content with fade animation */}
            <div
                className={cn(
                    "flex items-center gap-2 w-full",
                    "transition-opacity duration-150 ease-in-out",
                    isTransitioning ? "opacity-0" : "opacity-100"
                )}
            >
                {/* Tab icon for example tips (Requirements 5.1, 5.2) */}
                {showTabIcon && <TabIcon />}

                {/* Tip text with optional horizontal scroll */}
                <div className="flex-1 overflow-hidden">
                    <span
                        ref={textRef}
                        className={cn(
                            "inline-block whitespace-nowrap",
                            "text-muted-foreground/60 text-sm",
                            needsScrolling && "animate-marquee"
                        )}
                    >
                        {displayedTip.displayText}
                    </span>
                </div>
            </div>
        </div>
    )
}

// ============ Utility Functions ============

/**
 * Determines if Tab icon should be displayed for a given tip
 * Used for property testing
 * Validates: Requirements 5.1, 5.2
 */
export function shouldShowTabIcon(tip: TipItem): boolean {
    return isExampleTip(tip)
}

/**
 * Determines if Tab key should fill input for a given tip
 * Used for property testing
 * Validates: Requirements 4.1, 4.2
 */
export function shouldTabFill(tip: TipItem): boolean {
    return isExampleTip(tip)
}

/**
 * Gets the fill text for a tip (empty string for feature tips)
 * Used for property testing
 */
export function getTabFillText(tip: TipItem): string {
    return isExampleTip(tip) ? tip.fillText : ""
}
