"use client"

/**
 * Engine Context - 统一引擎服务上下文
 *
 * 架构说明：
 * - 使用 hooks/engines/ 中的独立 hooks 提供底层状态和 refs
 * - 使用 services/engine/ 中的 EngineService 封装通用操作
 * - 服务层通过 setOnHistoryChange 回调同步历史记录到 React 状态
 * - 提供 useEngine() 作为统一入口
 * 
 * 重命名历史：diagram-context.tsx -> engine-context.tsx
 * 兼容别名：useDiagram = useEngine, DiagramProvider = EngineProvider
 */

import type React from "react"
import { createContext, useContext, useCallback, useState, useEffect, useMemo, useRef } from "react"
import {
    useDrawioEngine,
    useExcalidrawEngine,
    useExcalidrawHistory,
    useEngineSwitch,
    sanitizeExcalidrawElements as sanitizeElements,
    EMPTY_EXCALIDRAW_SCENE as EMPTY_SCENE,
    type ExcalidrawScene,
    type ExcalidrawOperation,
    type EngineId,
} from "@/hooks/engines"
import {
    createDrawioService,
    createExcalidrawService,
    registerEngine,
    type EngineService,
} from "./"
import type { DrawioHistoryEntry, ExcalidrawHistoryEntry, UnifiedHistoryEntry } from "@/hooks/session"

// ============ 类型导出 ============

export type { ExcalidrawScene, ExcalidrawOperation }
export const EMPTY_EXCALIDRAW_SCENE = EMPTY_SCENE
export const sanitizeExcalidrawElements = sanitizeElements

// ============ Context 类型 ============

interface EngineContextType {
    // DrawIO 状态
    chartXML: string
    latestSvg: string
    diagramHistory: { svg: string; xml: string; timestamp?: number; isManual?: boolean }[]
    setDiagramHistory: (history: { svg: string; xml: string; timestamp?: number; isManual?: boolean }[]) => void
    pushDrawioHistory: (isManual?: boolean) => void
    deleteDrawioHistory: (index: number) => void
    chartXMLRef: React.MutableRefObject<string>

    // 引擎切换
    engineId: string
    setEngineId: (id: string) => void
    /** 是否正在切换引擎（用于显示过渡动画） */
    isSwitching: boolean
    /** 切换引擎并等待就绪，返回 Promise */
    switchEngine: (targetEngine: "drawio" | "excalidraw") => Promise<void>

    // DrawIO Refs
    drawioRef: React.RefObject<any>
    resolverRef: React.RefObject<((value: string) => void) | null>

    // DrawIO 操作
    loadDiagram: (chart: string, skipValidation?: boolean) => string | null
    handleExport: () => void
    handleExportWithoutHistory: () => void
    handleDiagramExport: (data: any) => void
    handleDrawioAutoSave: (data: { xml: string }) => void
    clearDiagram: () => void
    saveDiagramToFile: (
        filename: string,
        format: any,
        sessionId?: string,
        successMessage?: string,
    ) => void
    getThumbnailSvg: () => Promise<string | null>
    selectCells: (ids?: string[]) => void

    // DrawIO 生命周期
    isDrawioReady: boolean
    onDrawioLoad: () => void
    resetDrawioReady: () => void

    // Excalidraw Refs
    excalidrawApiRef: React.RefObject<any>
    excalidrawSceneRef: React.RefObject<ExcalidrawScene>
    initialDataRef: React.RefObject<ExcalidrawScene | null>

    // Excalidraw 操作
    setExcalidrawScene: (
        scene: ExcalidrawScene,
        options?: {
            skipUpdateCanvas?: boolean
            /** 是否记录到 undo 栈，支持 Ctrl+Z 撤销 */
            commitToHistory?: boolean
        },
    ) => Promise<void>
    getExcalidrawScene: () => ExcalidrawScene
    appendExcalidrawElements: (
        elements: any[],
        options?: { selectIds?: string[] },
    ) => Promise<{ newIds: string[] }>
    editExcalidrawByOperations: (
        operations: ExcalidrawOperation[],
    ) => Promise<{ newIds: string[] }>
    selectExcalidrawElements: (ids?: string[]) => void

    // Excalidraw 生命周期
    isExcalidrawReady: boolean
    setExcalidrawReady: (ready: boolean) => void

    // Excalidraw 历史记录
    excalidrawHistory: ExcalidrawHistoryEntry[]
    pushExcalidrawHistory: (label?: string, isManual?: boolean) => Promise<void>
    restoreExcalidrawVersion: (index: number) => void
    deleteExcalidrawVersion: (index: number) => void
    clearExcalidrawHistory: () => void
    initExcalidrawHistory: (entries: ExcalidrawHistoryEntry[]) => void
    getExcalidrawHistory: () => ExcalidrawHistoryEntry[]

    // 统一历史记录（合并两个引擎的历史，按时间戳降序排序）
    unifiedHistory: UnifiedHistoryEntry[]

    // 画布版本计数器：用于追踪画布内容变化（如快照恢复），触发 auto-save
    canvasVersion: number
    /** 通知画布内容已变化（递增 canvasVersion，触发 auto-save） */
    notifyCanvasChange: () => void

    // UI 状态
    showSaveDialog: boolean
    setShowSaveDialog: (show: boolean) => void

    // 服务层（用于统一操作入口）
    drawioService: EngineService
    excalidrawService: EngineService
    /** 获取当前引擎的服务实例 */
    getCurrentService: () => EngineService
}

const EngineContext = createContext<EngineContextType | undefined>(undefined)

// ============ Provider ============

export function EngineProvider({ children }: { children: React.ReactNode }) {
    // ========== 底层引擎 Hooks ==========
    const engineSwitch = useEngineSwitch("drawio")
    const drawio = useDrawioEngine()
    const excalidraw = useExcalidrawEngine()

    // Excalidraw 历史记录 Hook（保持现有实现）
    const excalidrawHistoryHook = useExcalidrawHistory({
        getScene: excalidraw.getScene,
        setScene: excalidraw.setScene,
        getThumbnailSvg: excalidraw.getThumbnailSvg,
    })

    // UI 状态
    const [showSaveDialog, setShowSaveDialog] = useState(false)

    // 画布版本计数器：用于追踪画布内容变化（如快照恢复），触发 auto-save
    const [canvasVersion, setCanvasVersion] = useState(0)

    // 引擎切换状态
    const [isSwitching, setIsSwitching] = useState(false)
    const switchResolverRef = useRef<(() => void) | null>(null)
    const switchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const switchTargetRef = useRef<"drawio" | "excalidraw" | null>(null)

    // ========== 服务层实例 ==========
    // 创建 DrawIO 服务（使用 useMemo 确保稳定引用）
    const drawioService = useMemo(() => {
        return createDrawioService({
            drawioRef: drawio.drawioRef,
            resolverRef: drawio.resolverRef,
            chartXMLRef: drawio.chartXMLRef,
            getLatestSvg: () => drawio.latestSvg,
            loadDiagram: drawio.loadDiagram,
        })
    }, []) // 只在挂载时创建一次

    // 创建 Excalidraw 服务
    const excalidrawService = useMemo(() => {
        return createExcalidrawService({
            apiRef: excalidraw.apiRef,
            sceneRef: excalidraw.sceneRef,
            getScene: excalidraw.getScene,
            setScene: excalidraw.setScene,
            getThumbnailSvg: excalidraw.getThumbnailSvg,
        })
    }, []) // 只在挂载时创建一次

    // 注册引擎服务到全局注册表
    useEffect(() => {
        registerEngine("drawio", drawioService)
        registerEngine("excalidraw", excalidrawService)
        console.log("[EngineProvider] Services registered")
    }, [drawioService, excalidrawService])

    // 同步 Hook 状态到服务层（就绪状态）
    useEffect(() => {
        drawioService.setReady(drawio.isReady)
    }, [drawio.isReady, drawioService])

    useEffect(() => {
        excalidrawService.setReady(excalidraw.isReady)
    }, [excalidraw.isReady, excalidrawService])

    // ========== 获取当前引擎服务 ==========
    const getCurrentService = useCallback((): EngineService => {
        return engineSwitch.engineId === "excalidraw" ? excalidrawService : drawioService
    }, [engineSwitch.engineId, drawioService, excalidrawService])

    // ========== 统一的 getThumbnailSvg（通过服务层）==========
    const getThumbnailSvg = useCallback(async (): Promise<string | null> => {
        return getCurrentService().getThumbnailSvg()
    }, [getCurrentService])

    // ========== 统一的 clearDiagram（通过服务层）==========
    const clearDiagram = useCallback(() => {
        return getCurrentService().clear()
    }, [getCurrentService])

    // ========== 通知画布变化函数 ==========
    const notifyCanvasChange = useCallback(() => {
        setCanvasVersion((v) => {
            console.log('[EngineContext] notifyCanvasChange', { oldVersion: v, newVersion: v + 1 })
            return v + 1
        })
    }, [])

    // ========== 引擎切换函数 ==========
    const SWITCH_TIMEOUT_MS = 10000 // 10秒超时

    const switchEngine = useCallback(async (targetEngine: "drawio" | "excalidraw"): Promise<void> => {
        // 如果已经是目标引擎，直接返回
        if (engineSwitch.engineId === targetEngine) {
            return
        }

        console.log('[EngineContext] switchEngine start:', { from: engineSwitch.engineId, to: targetEngine })
        
        // 清理之前的超时（如果有）
        if (switchTimeoutRef.current) {
            clearTimeout(switchTimeoutRef.current)
            switchTimeoutRef.current = null
        }

        // 重置目标引擎的 ready 状态，确保等待新的 ready 信号
        if (targetEngine === "drawio") {
            drawio.resetReady()
        } else {
            excalidraw.setReady(false)
        }

        setIsSwitching(true)
        switchTargetRef.current = targetEngine

        return new Promise<void>((resolve, reject) => {
            // 设置超时
            switchTimeoutRef.current = setTimeout(() => {
                console.error('[EngineContext] switchEngine timeout:', { targetEngine })
                setIsSwitching(false)
                switchResolverRef.current = null
                switchTargetRef.current = null
                reject(new Error(`Engine switch to ${targetEngine} timed out after ${SWITCH_TIMEOUT_MS}ms`))
            }, SWITCH_TIMEOUT_MS)

            switchResolverRef.current = () => {
                // 清理超时
                if (switchTimeoutRef.current) {
                    clearTimeout(switchTimeoutRef.current)
                    switchTimeoutRef.current = null
                }
                resolve()
            }
            engineSwitch.setEngineId(targetEngine)
        })
    }, [engineSwitch, drawio, excalidraw])

    // 监听引擎就绪状态，完成切换
    useEffect(() => {
        if (!isSwitching) return
        if (!switchResolverRef.current) return

        // 使用 switchTargetRef 确保检查正确的目标引擎
        const targetEngine = switchTargetRef.current
        if (!targetEngine) return

        // 确保当前引擎已切换到目标引擎
        if (engineSwitch.engineId !== targetEngine) {
            console.log('[EngineContext] switchEngine waiting for engineId change:', {
                current: engineSwitch.engineId,
                target: targetEngine
            })
            return
        }

        const isTargetReady = targetEngine === "excalidraw"
            ? excalidraw.isReady
            : drawio.isReady

        console.log('[EngineContext] switchEngine checking ready:', {
            targetEngine,
            isTargetReady,
            drawioReady: drawio.isReady,
            excalidrawReady: excalidraw.isReady
        })

        if (isTargetReady) {
            console.log('[EngineContext] switchEngine complete:', { engineId: engineSwitch.engineId })
            // 延迟一帧确保 UI 渲染完成
            requestAnimationFrame(() => {
                setIsSwitching(false)
                switchTargetRef.current = null
                switchResolverRef.current?.()
                switchResolverRef.current = null
            })
        }
    }, [isSwitching, engineSwitch.engineId, excalidraw.isReady, drawio.isReady])

    // ========== 统一历史记录 ==========
    const unifiedHistory = useMemo((): UnifiedHistoryEntry[] => {
        const drawioEntries: UnifiedHistoryEntry[] = drawio.diagramHistory.map((item, index) => ({
            engineId: "drawio" as const,
            timestamp: item.timestamp || 0,
            isManual: item.isManual,
            svg: item.svg,
            xml: item.xml,
            originalIndex: index,
        }))
        const excalidrawEntries: UnifiedHistoryEntry[] = excalidrawHistoryHook.history.map((item, index) => ({
            engineId: "excalidraw" as const,
            timestamp: item.timestamp,
            isManual: item.isManual,
            scene: item.scene,
            thumbnailDataUrl: item.thumbnailDataUrl,
            label: item.label,
            originalIndex: index,
        }))
        // 合并并按时间戳降序排序（最新的在前）
        return [...drawioEntries, ...excalidrawEntries]
            .sort((a, b) => b.timestamp - a.timestamp)
    }, [drawio.diagramHistory, excalidrawHistoryHook.history])

    // ========== Context Value ==========
    const value: EngineContextType = {
        // DrawIO 状态
        chartXML: drawio.chartXML,
        latestSvg: drawio.latestSvg,
        diagramHistory: drawio.diagramHistory,
        setDiagramHistory: drawio.setDiagramHistory,
        pushDrawioHistory: drawio.pushHistory,
        deleteDrawioHistory: drawio.deleteHistory,
        chartXMLRef: drawio.chartXMLRef,

        // 引擎切换
        engineId: engineSwitch.engineId,
        setEngineId: (id: string) => engineSwitch.setEngineId(id as EngineId),
        isSwitching,
        switchEngine,

        // DrawIO Refs
        drawioRef: drawio.drawioRef,
        resolverRef: drawio.resolverRef,

        // DrawIO 操作
        loadDiagram: drawio.loadDiagram,
        handleExport: drawio.handleExport,
        handleExportWithoutHistory: drawio.handleExportWithoutHistory,
        handleDiagramExport: drawio.handleDiagramExport,
        handleDrawioAutoSave: drawio.handleAutoSave,
        clearDiagram,
        saveDiagramToFile: drawio.saveDiagramToFile,
        getThumbnailSvg,
        selectCells: drawio.selectCells,

        // DrawIO 生命周期
        isDrawioReady: drawio.isReady,
        onDrawioLoad: drawio.onLoad,
        resetDrawioReady: drawio.resetReady,

        // Excalidraw Refs
        excalidrawApiRef: excalidraw.apiRef,
        excalidrawSceneRef: excalidraw.sceneRef,
        initialDataRef: excalidraw.initialDataRef,

        // Excalidraw 操作
        setExcalidrawScene: excalidraw.setScene,
        getExcalidrawScene: excalidraw.getScene,
        appendExcalidrawElements: excalidraw.appendElements,
        editExcalidrawByOperations: excalidraw.editByOperations,
        selectExcalidrawElements: excalidraw.selectElements,

        // Excalidraw 生命周期
        isExcalidrawReady: excalidraw.isReady,
        setExcalidrawReady: excalidraw.setReady,

        // Excalidraw 历史记录
        excalidrawHistory: excalidrawHistoryHook.history,
        pushExcalidrawHistory: excalidrawHistoryHook.pushHistory,
        restoreExcalidrawVersion: excalidrawHistoryHook.restoreVersion,
        deleteExcalidrawVersion: excalidrawHistoryHook.deleteVersion,
        clearExcalidrawHistory: excalidrawHistoryHook.clearHistory,
        initExcalidrawHistory: excalidrawHistoryHook.initHistory,
        getExcalidrawHistory: excalidrawHistoryHook.getHistory,

        // 统一历史记录
        unifiedHistory,

        // 画布版本计数器
        canvasVersion,
        notifyCanvasChange,

        // UI 状态
        showSaveDialog,
        setShowSaveDialog,

        // 服务层
        drawioService,
        excalidrawService,
        getCurrentService,
    }

    return (
        <EngineContext.Provider value={value}>
            {children}
        </EngineContext.Provider>
    )
}

// ============ Hook ============

export function useEngine() {
    const context = useContext(EngineContext)
    if (context === undefined) {
        throw new Error("useEngine must be used within an EngineProvider")
    }
    return context
}

// ============ 兼容别名（向后兼容）============

/** @deprecated 使用 useEngine 代替 */
export const useDiagram = useEngine

/** @deprecated 使用 EngineProvider 代替 */
export const DiagramProvider = EngineProvider

/** @deprecated 使用 EngineContextType 代替 */
export type DiagramContextType = EngineContextType
