"use client"

import { Check } from "lucide-react"
import type { ToolContentRendererProps } from "../types"

/**
 * 系统工具内容渲染器
 * 用于 switch_canvas 等系统工具
 */
export function SystemRenderer({ part, toolName }: ToolContentRendererProps) {
    const { state, input } = part
    
    if (toolName === "switch_canvas") {
        return <SwitchCanvasResult state={state} input={input} />
    }
    
    return null
}

interface SwitchCanvasResultProps {
    state?: string
    input?: Record<string, unknown>
}

function SwitchCanvasResult({ state, input }: SwitchCanvasResultProps) {
    // 只在完成时显示
    if (state !== "output-available") {
        return null
    }
    
    const target = (input as { target?: string })?.target || "unknown"
    const reason = (input as { reason?: string })?.reason
    
    return (
        <>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Check className="w-3 h-3 text-green-600" />
                <span>Switching to {target} canvas</span>
            </div>
            {reason && (
                <div className="text-xs text-muted-foreground/70 mt-1 ml-5">
                    {reason}
                </div>
            )}
        </>
    )
}
