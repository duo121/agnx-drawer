import { useState, useRef, useEffect } from "react"

type ToolboxView = "main" | "history" | "export" | "url" | "config"

// 高度配置
const HEIGHT_STORAGE_KEY = "toolbox-height"
const DEFAULT_HEIGHT = 400
export const MIN_HEIGHT = 200

// 缩放级别配置
export const ZOOM_LEVELS = [6, 4, 3, 2, 1]
const DEFAULT_ZOOM = 0 // 默认最小（6列）
const ZOOM_STORAGE_KEY = "toolbox-zoom"

// 读取保存的高度
function loadSavedHeight(): number {
    if (typeof window === "undefined") return DEFAULT_HEIGHT
    try {
        const saved = localStorage.getItem(HEIGHT_STORAGE_KEY)
        if (saved) {
            const height = parseInt(saved, 10)
            if (!isNaN(height) && height >= MIN_HEIGHT) {
                return height
            }
        }
    } catch (e) {
        // ignore
    }
    return DEFAULT_HEIGHT
}

// 读取保存的缩放级别
function loadSavedZoom(): number {
    if (typeof window === "undefined") return DEFAULT_ZOOM
    try {
        const saved = localStorage.getItem(ZOOM_STORAGE_KEY)
        if (saved) {
            const zoom = parseInt(saved, 10)
            if (!isNaN(zoom) && zoom >= 0 && zoom < ZOOM_LEVELS.length) {
                return zoom
            }
        }
    } catch (e) {
        // ignore
    }
    return DEFAULT_ZOOM
}

// 保存高度
export function saveHeight(height: number) {
    try {
        localStorage.setItem(HEIGHT_STORAGE_KEY, String(height))
    } catch (e) {
        // ignore
    }
}

// 保存缩放级别
export function saveZoom(zoom: number) {
    try {
        localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom))
    } catch (e) {
        // ignore
    }
}

export function useToolboxState() {
    // ============ 视图和高度 ============
    const [currentView, setCurrentView] = useState<ToolboxView>("main")
    const [height, setHeight] = useState(loadSavedHeight)
    const [zoomLevel, setZoomLevel] = useState(loadSavedZoom)

    // ============ 导出视图 ============
    const [saveFilename, setSaveFilename] = useState(
        `diagram-${new Date().toISOString().slice(0, 10)}`
    )
    const [saveFormat, setSaveFormat] = useState<"png" | "svg" | "drawio" | "excalidraw">("png")

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

    // ============ 高度变化时保存 ============
    useEffect(() => {
        if (!isDragging && height !== loadSavedHeight()) {
            saveHeight(height)
        }
    }, [height, isDragging])

    // ============ 缩放级别变化时保存 ============
    useEffect(() => {
        saveZoom(zoomLevel)
    }, [zoomLevel])

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
        // 视图和高度
        currentView,
        setCurrentView,
        height,
        setHeight,
        zoomLevel,
        setZoomLevel,

        // 导出视图
        saveFilename,
        setSaveFilename,
        saveFormat,
        setSaveFormat,

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
