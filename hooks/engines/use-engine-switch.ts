"use client"

/**
 * 引擎切换 Hook
 *
 * 管理 DrawIO 和 Excalidraw 引擎之间的切换逻辑
 * 负责状态同步、会话保存/恢复等
 */

import { useCallback, useState } from "react"

// ============ 类型 ============

export type EngineId = "drawio" | "excalidraw"

export interface UseEngineSwitchReturn {
    // 当前引擎
    engineId: EngineId
    setEngineId: (id: EngineId) => void

    // 引擎切换
    switchEngine: (targetEngine: EngineId) => void

    // 工具函数
    isDrawio: boolean
    isExcalidraw: boolean
}

// ============ Hook ============

export function useEngineSwitch(
    initialEngine: EngineId = "drawio"
): UseEngineSwitchReturn {
    const [engineId, setEngineId] = useState<EngineId>(initialEngine)

    const switchEngine = useCallback((targetEngine: EngineId) => {
        if (targetEngine === engineId) {
            console.log("[useEngineSwitch] Already on target engine:", targetEngine)
            return
        }

        console.log("[useEngineSwitch] Switching engine:", {
            from: engineId,
            to: targetEngine,
        })

        setEngineId(targetEngine)
    }, [engineId])

    return {
        engineId,
        setEngineId,
        switchEngine,
        isDrawio: engineId === "drawio",
        isExcalidraw: engineId === "excalidraw",
    }
}
