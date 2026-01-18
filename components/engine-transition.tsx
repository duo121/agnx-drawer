"use client"

/**
 * EngineTransition - 引擎切换过渡动画组件
 * 
 * 当引擎（DrawIO ↔ Excalidraw）切换时显示惊艳的过渡动画
 */

import { memo, useMemo } from "react"

interface EngineTransitionProps {
    /** 目标引擎 ID */
    targetEngine: "drawio" | "excalidraw"
}

// DrawIO 图标 - 结构化方块
const DrawioIcon = memo(function DrawioIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-16 h-16 text-blue-400"
        >
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
            {/* 连接线 */}
            <path d="M10 6.5h4" strokeDasharray="2 1" opacity="0.6" />
            <path d="M6.5 10v4" strokeDasharray="2 1" opacity="0.6" />
            <path d="M17.5 10v4" strokeDasharray="2 1" opacity="0.6" />
            <path d="M10 17.5h4" strokeDasharray="2 1" opacity="0.6" />
        </svg>
    )
})

// Excalidraw 图标 - 手绘风格
const ExcalidrawIcon = memo(function ExcalidrawIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-16 h-16 text-purple-400"
        >
            {/* 手绘曲线 */}
            <path d="M4 17c3-4 6-2 8-6s4-7 8-5" />
            <path d="M3 12c2 2 5 1 7-1s4-5 7-4" opacity="0.7" />
            {/* 画笔笔触 */}
            <path d="M18 8l2-2" strokeWidth="2" />
            <circle cx="19" cy="7" r="1" fill="currentColor" />
            {/* 星星装饰 */}
            <path d="M7 6l0.5-1.5L8 6l1.5 0.5L8 7l-0.5 1.5L7 7l-1.5-0.5z" opacity="0.6" />
        </svg>
    )
})

// 粒子组件
const Particles = memo(function Particles({ color }: { color: string }) {
    const particles = useMemo(() => {
        return Array.from({ length: 8 }, (_, i) => ({
            id: i,
            size: 4 + Math.random() * 4,
            x: 20 + Math.random() * 60,
            y: 30 + Math.random() * 40,
            delay: Math.random() * 2,
            duration: 2 + Math.random() * 1.5,
        }))
    }, [])

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="absolute rounded-full"
                    style={{
                        width: p.size,
                        height: p.size,
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        backgroundColor: color,
                        opacity: 0,
                        animation: `engine-particle-float ${p.duration}s ease-in-out ${p.delay}s infinite`,
                    }}
                />
            ))}
        </div>
    )
})

export const EngineTransition = memo(function EngineTransition({
    targetEngine,
}: EngineTransitionProps) {
    const isExcalidraw = targetEngine === "excalidraw"
    const Icon = isExcalidraw ? ExcalidrawIcon : DrawioIcon
    const engineName = isExcalidraw ? "Excalidraw" : "DrawIO"
    const particleColor = isExcalidraw
        ? "oklch(0.7 0.2 280)"  // 紫色
        : "oklch(0.7 0.15 250)" // 蓝色

    return (
        <div
            className="absolute inset-0 z-50 flex items-center justify-center engine-transition-overlay"
            style={{
                animation: "engine-fade-in 0.3s ease-out forwards",
            }}
        >
            {/* 粒子背景 */}
            <Particles color={particleColor} />

            {/* 中心内容 */}
            <div className="relative flex flex-col items-center gap-6">
                {/* 图标容器 */}
                <div className="engine-icon-container">
                    {/* 旋转光环 */}
                    <div className="engine-icon-ring" />
                    {/* 第二个光环（反向） */}
                    <div
                        className="engine-icon-ring"
                        style={{
                            animationDirection: "reverse",
                            animationDuration: "2s",
                            borderTopColor: isExcalidraw
                                ? "oklch(0.65 0.25 280)"
                                : "oklch(0.65 0.2 250)",
                            inset: "-12px",
                            opacity: 0.5,
                        }}
                    />
                    {/* 图标 */}
                    <div
                        className="relative z-10 p-4 rounded-2xl"
                        style={{
                            background: isExcalidraw
                                ? "linear-gradient(135deg, oklch(0.3 0.1 280 / 0.8), oklch(0.25 0.08 300 / 0.6))"
                                : "linear-gradient(135deg, oklch(0.3 0.08 250 / 0.8), oklch(0.25 0.06 230 / 0.6))",
                            boxShadow: `0 8px 32px ${isExcalidraw ? "oklch(0.5 0.2 280 / 0.3)" : "oklch(0.5 0.15 250 / 0.3)"}`,
                        }}
                    >
                        <Icon />
                    </div>
                </div>

                {/* 文字 */}
                <div className="text-center">
                    <p className="text-sm text-white/60 mb-1">正在切换到</p>
                    <p className="text-xl font-medium engine-transition-text">
                        {engineName}
                    </p>
                </div>

                {/* 加载指示器 */}
                <div className="flex gap-1.5 mt-2">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="w-2 h-2 rounded-full"
                            style={{
                                backgroundColor: isExcalidraw
                                    ? "oklch(0.7 0.2 280)"
                                    : "oklch(0.7 0.15 250)",
                                animation: `engine-icon-pulse 1s ease-in-out ${i * 0.2}s infinite`,
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
})
