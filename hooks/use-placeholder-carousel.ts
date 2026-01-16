"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// ============ Type Definitions ============

export type TipType = "feature" | "example"

export interface BaseTipItem {
    id: string
    type: TipType
    displayText: string
    fillText: string              // 所有提示语都支持 Tab 填充
    files?: () => Promise<File[]> // 可选的关联文件加载函数
}

export interface FeatureTip extends BaseTipItem {
    type: "feature"
}

export interface ExampleTip extends BaseTipItem {
    type: "example"
}

export type TipItem = FeatureTip | ExampleTip

// Type guard for ExampleTip
export function isExampleTip(tip: TipItem): tip is ExampleTip {
    return tip.type === "example"
}

// ============ Hook Options & Return Types ============

export interface UsePlaceholderCarouselOptions {
    tips: TipItem[]
    interval?: number // Carousel interval in ms, default 3000
    enabled?: boolean // Whether carousel is enabled
}

export interface UsePlaceholderCarouselReturn {
    currentTip: TipItem | null
    currentIndex: number
    isScrolling: boolean
    isPaused: boolean
    pause: () => void
    resume: () => void
    reset: () => void
}

// ============ Default Values ============

const DEFAULT_INTERVAL = 3000

// ============ Hook Implementation ============

export function usePlaceholderCarousel({
    tips,
    interval = DEFAULT_INTERVAL,
    enabled = true,
}: UsePlaceholderCarouselOptions): UsePlaceholderCarouselReturn {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isPaused, setIsPaused] = useState(false)
    const [isScrolling, setIsScrolling] = useState(false)

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Clear timer helper
    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }
    }, [])

    // Start timer helper
    const startTimer = useCallback(() => {
        clearTimer()
        if (!enabled || tips.length === 0 || isPaused) return

        timerRef.current = setTimeout(() => {
            setCurrentIndex((prev) => {
                // Cycle back to 0 when reaching the end
                if (prev >= tips.length - 1) {
                    return 0
                }
                return prev + 1
            })
        }, interval)
    }, [enabled, tips.length, isPaused, interval, clearTimer])

    // Pause carousel
    const pause = useCallback(() => {
        setIsPaused(true)
        clearTimer()
    }, [clearTimer])

    // Resume carousel
    const resume = useCallback(() => {
        setIsPaused(false)
    }, [])

    // Reset to first tip
    const reset = useCallback(() => {
        setCurrentIndex(0)
        setIsPaused(false)
        setIsScrolling(false)
    }, [])

    // Start/restart timer when dependencies change
    useEffect(() => {
        if (enabled && !isPaused && tips.length > 0) {
            startTimer()
        }
        return clearTimer
    }, [enabled, isPaused, tips.length, currentIndex, startTimer, clearTimer])

    // Reset index if tips array changes and current index is out of bounds
    useEffect(() => {
        if (tips.length > 0 && currentIndex >= tips.length) {
            setCurrentIndex(0)
        }
    }, [tips.length, currentIndex])

    // Get current tip
    const currentTip = tips.length > 0 ? tips[currentIndex] : null

    return {
        currentTip,
        currentIndex,
        isScrolling,
        isPaused,
        pause,
        resume,
        reset,
    }
}
