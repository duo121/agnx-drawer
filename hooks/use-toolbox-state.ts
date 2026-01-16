import { useState, useRef, useEffect, useCallback } from "react"
import { useToolboxSession, ZOOM_LEVELS, MIN_HEIGHT, MAX_HEIGHT_VH } from "./use-toolbox-session"

// 重新导出常量供外部使用
export { ZOOM_LEVELS, MIN_HEIGHT, MAX_HEIGHT_VH }

type ToolboxView = "main" | "history" | "export" | "url" | "config"

export function useToolboxState() {
    // ============ Session 存储（持久化） ============
    const { session, updateSession, saveNow } = useToolboxSession()

    // ============ 视图状态（非持久化） ============
    const [currentView, setCurrentView] = useState<ToolboxView>("main")

    // ============ 导出视图 ============
    const [saveFilename, setSaveFilename] = useState(
        `diagram-${new Date().toISOString().slice(0, 10)}`
    )

    // ============ URL 提取 ============
    const [urlInput, setUrlInput] = useState("")
    const [isExtractingUrl, setIsExtractingUrl] = useState(false)

    // ============ 模型配置 ============
    const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
    const [showApiKey, setShowApiKey] = useState(false)
    const [validationStatus, setValidationStatus] = useState<"idle" | "validating" | "success" | "error">("idle")
    const [validationError, setValidationError] = useState("")
    const [customModelInput, setCustomModelInput] = useState("")
    const [duplicateError, setDuplicateError] = useState("")
    const [validatingModelIndex, setValidatingModelIndex] = useState<number | null>(null)
    const [providerDeleteConfirm, setProviderDeleteConfirm] = useState<string | null>(null)
    const validationResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // ============ 拖拽调整高度 ============
    const [isDragging, setIsDragging] = useState(false)
    const dragStartY = useRef(0)
    const dragStartHeight = useRef(0)

    // ============ 工具栏 tooltip 位置 ============
    const [tooltipPosition, setTooltipPosition] = useState<{ left: number } | null>(null)

    // ============ 高度管理 ============
    const setHeight = useCallback((height: number) => {
        updateSession("height", height)
    }, [updateSession])

    // ============ 版本缩放级别管理 ============
    const setVersionZoomLevel = useCallback((zoomLevel: number) => {
        updateSession("versionZoomLevel", zoomLevel)
    }, [updateSession])

    // ============ 历史会话缩放级别管理 ============
    const setSessionZoomLevel = useCallback((zoomLevel: number) => {
        updateSession("sessionZoomLevel", zoomLevel)
    }, [updateSession])

    // ============ 导出格式管理 ============
    const setSaveFormat = useCallback((format: "png" | "svg" | "drawio" | "excalidraw") => {
        updateSession("exportFormat", format)
    }, [updateSession])

    // ============ 历史版本布局管理 ============
    const setHistoryLayout = useCallback((layout: "grid" | "scroll") => {
        updateSession("historyLayout", layout)
    }, [updateSession])

    const toggleHistoryLayout = useCallback(() => {
        updateSession("historyLayout", session.historyLayout === "grid" ? "scroll" : "grid")
    }, [updateSession, session.historyLayout])

    // ============ 历史会话布局管理 ============
    const setSessionLayout = useCallback((layout: "grid" | "scroll") => {
        updateSession("sessionLayout", layout)
    }, [updateSession])

    const toggleSessionLayout = useCallback(() => {
        updateSession("sessionLayout", session.sessionLayout === "grid" ? "scroll" : "grid")
    }, [updateSession, session.sessionLayout])

    // ============ 拖拽结束时立即保存 ============
    useEffect(() => {
        if (!isDragging) {
            saveNow()
        }
    }, [isDragging, saveNow])

    // ============ 清理验证超时 ============
    useEffect(() => {
        return () => {
            if (validationResetTimeoutRef.current) {
                clearTimeout(validationResetTimeoutRef.current)
            }
        }
    }, [])

    // ============ 重置方法 ============
    const resetValidationState = () => {
        setValidationStatus("idle")
        setValidationError("")
        setValidatingModelIndex(null)
    }

    const resetConfigState = () => {
        setSelectedProviderId(null)
        setShowApiKey(false)
        resetValidationState()
        setProviderDeleteConfirm(null)
    }

    return {
        // 视图
        currentView,
        setCurrentView,
        
        // 持久化状态（从 session）
        height: session.height,
        setHeight,
        versionZoomLevel: session.versionZoomLevel,
        setVersionZoomLevel,
        sessionZoomLevel: session.sessionZoomLevel,
        setSessionZoomLevel,
        saveFormat: session.exportFormat,
        setSaveFormat,
        historyLayout: session.historyLayout,
        setHistoryLayout,
        toggleHistoryLayout,
        sessionLayout: session.sessionLayout,
        setSessionLayout,
        toggleSessionLayout,

        // 导出视图
        saveFilename,
        setSaveFilename,

        // URL 提取
        urlInput,
        setUrlInput,
        isExtractingUrl,
        setIsExtractingUrl,

        // 模型配置
        selectedProviderId,
        setSelectedProviderId,
        showApiKey,
        setShowApiKey,
        validationStatus,
        setValidationStatus,
        validationError,
        setValidationError,
        customModelInput,
        setCustomModelInput,
        duplicateError,
        setDuplicateError,
        validatingModelIndex,
        setValidatingModelIndex,
        providerDeleteConfirm,
        setProviderDeleteConfirm,
        validationResetTimeoutRef,

        // 拖拽调整高度
        isDragging,
        setIsDragging,
        dragStartY,
        dragStartHeight,

        // 工具栏 tooltip 位置
        tooltipPosition,
        setTooltipPosition,

        // 重置方法
        resetValidationState,
        resetConfigState,
    }
}

// 兼容性导出：保留旧的 saveHeight 函数供外部使用
export function saveHeight(height: number) {
    // 这个函数现在是空操作，因为保存由 useToolboxSession 内部处理
    // 保留是为了兼容性，避免破坏现有代码
}
