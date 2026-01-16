import { useState, useEffect, useCallback, useRef } from "react"

// ============ 类型定义 ============

export interface ToolboxSession {
    // 高度和缩放
    height: number
    versionZoomLevel: number // 历史版本缩放级别
    sessionZoomLevel: number // 历史会话缩放级别
    
    // 导出偏好
    exportFormat: "png" | "svg" | "drawio" | "excalidraw"
    
    // 历史版本布局: grid = 换行网格, scroll = 单行水平滚动
    historyLayout: "grid" | "scroll"
    
    // 历史会话布局: grid = 换行网格, scroll = 单行水平滚动
    sessionLayout: "grid" | "scroll"
    
    // 最后使用的视图（可选，用于恢复状态）
    lastView?: "main" | "history" | "export" | "url" | "config"
}

// ============ 常量配置 ============

const STORAGE_KEY = "agnx-drawer-toolbox"

// 高度配置
const DEFAULT_HEIGHT = 400
export const MIN_HEIGHT = 200
export const MAX_HEIGHT_VH = 0.9 // 90vh

// 缩放级别配置
export const ZOOM_LEVELS = [6, 4, 3, 2, 1] // 列数
const DEFAULT_ZOOM = 0 // 默认最小（6列）

// 默认 session
const DEFAULT_SESSION: ToolboxSession = {
    height: DEFAULT_HEIGHT,
    versionZoomLevel: DEFAULT_ZOOM, // 历史版本默认缩放
    sessionZoomLevel: DEFAULT_ZOOM, // 历史会话默认缩放
    exportFormat: "png",
    historyLayout: "scroll", // 默认折叠（单行滚动）
    sessionLayout: "scroll", // 默认折叠（单行滚动）
}

// ============ 存储工具函数 ============

function loadSession(): ToolboxSession {
    if (typeof window === "undefined") return DEFAULT_SESSION
    
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            const parsed = JSON.parse(saved) as Partial<ToolboxSession>
            return {
                ...DEFAULT_SESSION,
                ...parsed,
                // 验证高度范围
                height: Math.max(MIN_HEIGHT, parsed.height ?? DEFAULT_HEIGHT),
                // 验证版本缩放级别范围
                versionZoomLevel: Math.min(
                    ZOOM_LEVELS.length - 1,
                    Math.max(0, parsed.versionZoomLevel ?? parsed.zoomLevel ?? DEFAULT_ZOOM)
                ),
                // 验证会话缩放级别范围
                sessionZoomLevel: Math.min(
                    ZOOM_LEVELS.length - 1,
                    Math.max(0, parsed.sessionZoomLevel ?? DEFAULT_ZOOM)
                ),
            }
        }
    } catch {
        // ignore parse errors
    }
    
    // 迁移旧数据
    return migrateOldStorage()
}

// 迁移旧的分散存储到新的统一存储
function migrateOldStorage(): ToolboxSession {
    if (typeof window === "undefined") return DEFAULT_SESSION
    
    const session = { ...DEFAULT_SESSION }
    
    try {
        // 迁移旧的高度设置
        const oldHeight = localStorage.getItem("toolbox-height")
        if (oldHeight) {
            const height = parseInt(oldHeight, 10)
            if (!isNaN(height) && height >= MIN_HEIGHT) {
                session.height = height
            }
            localStorage.removeItem("toolbox-height")
        }
        
        // 迁移旧的缩放设置
        const oldZoom = localStorage.getItem("toolbox-zoom")
        if (oldZoom) {
            const zoom = parseInt(oldZoom, 10)
            if (!isNaN(zoom) && zoom >= 0 && zoom < ZOOM_LEVELS.length) {
                session.versionZoomLevel = zoom
            }
            localStorage.removeItem("toolbox-zoom")
        }
        
        // 如果有迁移的数据，保存到新的存储
        if (oldHeight || oldZoom) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
        }
    } catch {
        // ignore migration errors
    }
    
    return session
}

function saveSession(session: ToolboxSession): void {
    if (typeof window === "undefined") return
    
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } catch {
        // ignore save errors
    }
}

// ============ Hook ============

export function useToolboxSession() {
    const [session, setSession] = useState<ToolboxSession>(loadSession)
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    
    // 防抖保存
    const debouncedSave = useCallback((newSession: ToolboxSession) => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
        }
        saveTimeoutRef.current = setTimeout(() => {
            saveSession(newSession)
            saveTimeoutRef.current = null
        }, 300)
    }, [])
    
    // 清理
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current)
            }
        }
    }, [])
    
    // 更新单个字段
    const updateSession = useCallback(<K extends keyof ToolboxSession>(
        key: K,
        value: ToolboxSession[K]
    ) => {
        setSession(prev => {
            const newSession = { ...prev, [key]: value }
            debouncedSave(newSession)
            return newSession
        })
    }, [debouncedSave])
    
    // 批量更新
    const updateSessionBatch = useCallback((updates: Partial<ToolboxSession>) => {
        setSession(prev => {
            const newSession = { ...prev, ...updates }
            debouncedSave(newSession)
            return newSession
        })
    }, [debouncedSave])
    
    // 立即保存（用于拖拽结束等场景）
    const saveNow = useCallback(() => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
            saveTimeoutRef.current = null
        }
        saveSession(session)
    }, [session])
    
    return {
        session,
        updateSession,
        updateSessionBatch,
        saveNow,
    }
}
