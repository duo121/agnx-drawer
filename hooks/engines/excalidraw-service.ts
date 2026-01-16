/**
 * Excalidraw 引擎服务实现
 *
 * 实现 EngineService 接口，封装 Excalidraw 的通用功能。
 * 专属功能通过 useExcalidrawEngine Hook 提供。
 */

import type { EngineService, HistoryEntry, ExcalidrawServiceDeps } from "./types"
import type { ExcalidrawHistoryEntry, ExcalidrawScene } from "@/hooks/session"

// ============ 常量 ============

const EMPTY_SCENE: ExcalidrawScene = {
    elements: [],
    appState: {
        theme: "dark",
        viewBackgroundColor: "#ffffff",
        currentItemStrokeColor: "#94a3b8",
        currentItemBackgroundColor: "transparent",
        gridSize: null,
        selectedElementIds: {},
        activeTool: { type: "selection" },
        name: "",
    },
    files: {},
}

const MAX_HISTORY_ENTRIES = 20
const MAX_SCENE_SIZE_FOR_FILES = 1024 * 1024 // 1MB

// ============ 工具函数 ============

/**
 * 深拷贝场景数据
 */
function cloneScene(scene: ExcalidrawScene): ExcalidrawScene {
    return JSON.parse(JSON.stringify(scene))
}

/**
 * 计算场景数据大小（字节）
 */
function getSceneSize(scene: ExcalidrawScene): number {
    return new Blob([JSON.stringify(scene)]).size
}

/**
 * 清理大型场景的 files 字段以节省存储空间
 */
function sanitizeSceneForStorage(scene: ExcalidrawScene): ExcalidrawScene {
    const size = getSceneSize(scene)
    if (size > MAX_SCENE_SIZE_FOR_FILES && scene.files) {
        const fileRefs: Record<string, any> = {}
        Object.keys(scene.files).forEach((key) => {
            fileRefs[key] = { id: key, _stripped: true }
        })
        return {
            ...scene,
            files: fileRefs,
        }
    }
    return scene
}

// ============ 类型转换 ============

/**
 * 将 Excalidraw 历史记录转换为统一格式
 */
function toHistoryEntry(entry: ExcalidrawHistoryEntry): HistoryEntry {
    return {
        timestamp: entry.timestamp,
        thumbnailDataUrl: entry.thumbnailDataUrl,
        isManual: entry.isManual,
        label: entry.label,
    }
}

// ============ 服务实现 ============

/**
 * 创建 Excalidraw 引擎服务
 */
export function createExcalidrawService(deps: ExcalidrawServiceDeps): EngineService {
    const {
        apiRef,
        sceneRef,
        getScene,
        setScene,
        getThumbnailSvg: getThumbnailSvgFromDeps,
    } = deps

    // 内部状态
    let _isReady = false
    let _history: ExcalidrawHistoryEntry[] = []
    let _currentIndex = -1 // -1 表示最新状态
    let _onHistoryChange: ((history: ExcalidrawHistoryEntry[]) => void) | null = null

    // 内部辅助函数：通知历史变更
    const notifyHistoryChange = (history: ExcalidrawHistoryEntry[]) => {
        if (_onHistoryChange) {
            _onHistoryChange(history)
        }
    }

    // 设置历史变更回调
    const setOnHistoryChange = (callback: ((history: ExcalidrawHistoryEntry[]) => void) | null) => {
        _onHistoryChange = callback
    }

    // ========== 生命周期 ==========

    const setReady = (ready: boolean) => {
        _isReady = ready
    }

    const resetReady = () => {
        _isReady = false
    }

    // ========== 画布操作 ==========

    const clear = async () => {
        await setScene(EMPTY_SCENE)
        _history = []
        notifyHistoryChange([])
    }

    const selectElements = (ids?: string[]) => {
        if (!apiRef.current) return

        const selected =
            ids && ids.length > 0
                ? ids.reduce<Record<string, boolean>>((acc, id) => {
                      acc[id] = true
                      return acc
                  }, {})
                : {}

        const api = apiRef.current
        try {
            api.updateScene({
                appState: {
                    selectedElementIds: selected,
                    activeTool: { type: "selection" },
                },
            })
        } catch (error) {
            console.warn("[ExcalidrawService.selectElements] Failed:", error)
        }
    }

    const getThumbnailSvg = async (): Promise<string | null> => {
        return getThumbnailSvgFromDeps()
    }

    // ========== 历史记录 ==========

    const getHistory = (): HistoryEntry[] => {
        return _history.map(toHistoryEntry)
    }

    const pushHistory = async (label?: string, isManual?: boolean) => {
        const scene = getScene()

        // 空场景不保存
        if (!scene.elements || scene.elements.length === 0) {
            return
        }

        // 生成缩略图
        let thumbnailDataUrl: string | undefined
        try {
            const svg = await getThumbnailSvg()
            if (svg) {
                thumbnailDataUrl = svg
            }
        } catch (error) {
            console.warn("[ExcalidrawService.pushHistory] Failed to generate thumbnail:", error)
        }

        const entry: ExcalidrawHistoryEntry = {
            timestamp: Date.now(),
            label,
            scene: sanitizeSceneForStorage(cloneScene(scene)),
            thumbnailDataUrl,
            isManual,
        }

        let newHistory = [..._history, entry]

        // 限制历史记录数量（只限制自动保存的，手动保存的不限制）
        const autoEntries = newHistory.filter(e => !e.isManual)
        const manualEntries = newHistory.filter(e => e.isManual)

        if (autoEntries.length > MAX_HISTORY_ENTRIES) {
            // 保留第一个自动保存和最后几个自动保存
            const first = autoEntries[0]
            const rest = autoEntries.slice(-(MAX_HISTORY_ENTRIES - 1))
            const trimmedAuto = [first, ...rest]
            // 合并并按时间排序
            newHistory = [...trimmedAuto, ...manualEntries].sort((a, b) => a.timestamp - b.timestamp)
        }

        _history = newHistory
        _currentIndex = -1 // 重置到最新
        notifyHistoryChange(newHistory)
    }

    const deleteHistory = (index: number) => {
        if (index < 0 || index >= _history.length) {
            console.warn("[ExcalidrawService.deleteHistory] Invalid index:", index)
            return
        }

        const entry = _history[index]
        // 只允许删除手动保存的版本
        if (!entry?.isManual) {
            console.warn("[ExcalidrawService.deleteHistory] Cannot delete auto-saved entry")
            return
        }

        _history = _history.filter((_, i) => i !== index)
        notifyHistoryChange(_history)

        // 如果删除的是当前选中的版本，重置索引
        if (_currentIndex === index) {
            _currentIndex = -1
        } else if (_currentIndex > index) {
            _currentIndex = _currentIndex - 1
        }
    }

    const restoreHistory = async (index: number) => {
        if (index < 0 || index >= _history.length) {
            console.warn("[ExcalidrawService.restoreHistory] Invalid index:", index)
            return
        }

        const entry = _history[index]
        if (!entry?.scene) {
            console.warn("[ExcalidrawService.restoreHistory] Invalid entry at index:", index)
            return
        }

        // 恢复场景
        await setScene(cloneScene(entry.scene))
        _currentIndex = index
    }

    const initHistory = (entries: HistoryEntry[]) => {
        // 这里假设传入的是已经包含 scene 的完整条目
        const validEntries = (entries as unknown as ExcalidrawHistoryEntry[]).filter(
            (e) => e && e.timestamp && e.scene && Array.isArray(e.scene.elements)
        )
        _history = validEntries
        _currentIndex = -1
        notifyHistoryChange(validEntries)
    }

    const clearHistory = () => {
        _history = []
        _currentIndex = -1
        notifyHistoryChange([])
    }

    // ========== 返回服务实例 ==========

    return {
        id: "excalidraw",
        displayName: "Excalidraw",

        get isReady() {
            return _isReady
        },

        setReady,
        resetReady,
        clear,
        selectElements,
        getThumbnailSvg,
        getHistory,
        pushHistory,
        deleteHistory,
        restoreHistory,
        initHistory,
        clearHistory,
        setOnHistoryChange,
    }
}
