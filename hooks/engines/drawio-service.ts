/**
 * DrawIO 引擎服务实现
 *
 * 实现 EngineService 接口，封装 DrawIO 的通用功能。
 * 专属功能通过 useDrawioEngine Hook 提供。
 */

import type { EngineService, HistoryEntry, DrawioServiceDeps } from "./types"
import type { DrawioHistoryEntry } from "@/hooks/session"
import { isRealDiagram } from "@/shared/utils"

// ============ 常量 ============

const EMPTY_DIAGRAM = `<mxfile><diagram name="Page-1" id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`
const MAX_HISTORY_SIZE = 20

// ============ 类型转换 ============

/**
 * 将 DrawIO 历史记录转换为统一格式
 */
function toHistoryEntry(entry: DrawioHistoryEntry): HistoryEntry {
    return {
        timestamp: entry.timestamp || Date.now(),
        thumbnailDataUrl: entry.svg,
        isManual: entry.isManual,
        label: undefined,
    }
}

/**
 * 将统一格式转换为 DrawIO 历史记录
 */
function fromHistoryEntry(entry: HistoryEntry, xml: string, svg: string): DrawioHistoryEntry {
    return {
        timestamp: entry.timestamp,
        svg: entry.thumbnailDataUrl || svg,
        xml,
        isManual: entry.isManual,
    }
}

// ============ 服务实现 ============

/**
 * 创建 DrawIO 引擎服务
 */
export function createDrawioService(deps: DrawioServiceDeps): EngineService {
    const {
        drawioRef,
        resolverRef,
        chartXMLRef,
        getLatestSvg,
        loadDiagram,
    } = deps

    // 内部状态
    let _isReady = false
    let _history: DrawioHistoryEntry[] = []
    let _onHistoryChange: ((history: DrawioHistoryEntry[]) => void) | null = null

    // 内部辅助函数：通知历史变更
    const notifyHistoryChange = (history: DrawioHistoryEntry[]) => {
        if (_onHistoryChange) {
            _onHistoryChange(history)
        }
    }

    // 设置历史变更回调
    const setOnHistoryChange = (callback: ((history: DrawioHistoryEntry[]) => void) | null) => {
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

    const clear = () => {
        loadDiagram(EMPTY_DIAGRAM, true)
        _history = []
        notifyHistoryChange([])
    }

    const selectElements = (ids?: string[]) => {
        const ref: any = drawioRef.current
        if (!ref) return

        try {
            if (ids && ids.length > 0) {
                if (typeof ref.execute === "function") {
                    ref.execute("selectCells", ids)
                    return
                }
                if (ref.selectionModel?.selectCells) {
                    ref.selectionModel.selectCells(ids)
                    return
                }
            }
            if (typeof ref.execute === "function") {
                ref.execute("selectAll")
            }
            if (ref.graph?.selectionModel?.selectAll) {
                ref.graph.selectionModel.selectAll()
            }
        } catch (error) {
            console.warn("[DrawioService.selectElements] Failed:", error)
        }
    }

    const getThumbnailSvg = async (): Promise<string | null> => {
        if (!drawioRef.current) return null
        if (!isRealDiagram(chartXMLRef.current)) return null

        try {
            const svgData = await Promise.race([
                new Promise<string>((resolve) => {
                    if (resolverRef.current !== undefined) {
                        (resolverRef as any).current = resolve
                    }
                    drawioRef.current?.exportDiagram({ format: "xmlsvg" })
                }),
                new Promise<string>((_, reject) =>
                    setTimeout(() => reject(new Error("Export timeout")), 3000)
                ),
            ])

            if (svgData?.includes("<svg")) {
                return svgData
            }
            return null
        } catch {
            return null
        }
    }

    // ========== 历史记录 ==========

    const getHistory = (): HistoryEntry[] => {
        return _history.map(toHistoryEntry)
    }

    const pushHistory = (label?: string, isManual?: boolean) => {
        const svg = getLatestSvg()
        const xml = chartXMLRef.current

        if (!svg || !isRealDiagram(xml)) {
            console.warn("[DrawioService.pushHistory] No valid diagram to save")
            return
        }

        const newEntry: DrawioHistoryEntry = {
            svg,
            xml,
            timestamp: Date.now(),
            isManual: isManual ?? false,
        }

        let newHistory = [..._history, newEntry]

        // 只限制自动保存的数量
        const autoEntries = newHistory.filter(e => !e.isManual)
        const manualEntries = newHistory.filter(e => e.isManual)
        if (autoEntries.length > MAX_HISTORY_SIZE) {
            const trimmedAuto = autoEntries.slice(-MAX_HISTORY_SIZE)
            newHistory = [...trimmedAuto, ...manualEntries].sort(
                (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
            )
        }

        _history = newHistory
        notifyHistoryChange(newHistory)
    }

    const deleteHistory = (index: number) => {
        if (index < 0 || index >= _history.length) {
            console.warn("[DrawioService.deleteHistory] Invalid index:", index)
            return
        }

        const entry = _history[index]
        // 只允许删除手动保存的
        if (!entry.isManual) {
            console.warn("[DrawioService.deleteHistory] Cannot delete auto-saved entry")
            return
        }

        _history = _history.filter((_, i) => i !== index)
        notifyHistoryChange(_history)
    }

    const restoreHistory = (index: number) => {
        if (index < 0 || index >= _history.length) {
            console.warn("[DrawioService.restoreHistory] Invalid index:", index)
            return
        }

        const entry = _history[index]
        if (entry.xml) {
            loadDiagram(entry.xml, true)
        }
    }

    const initHistory = (entries: HistoryEntry[]) => {
        // 注意：统一格式没有 xml，需要从外部提供完整的 DrawioHistoryEntry
        // 这里假设传入的是已经包含 xml 的完整条目
        _history = entries as unknown as DrawioHistoryEntry[]
        notifyHistoryChange(_history)
    }

    const clearHistory = () => {
        _history = []
        notifyHistoryChange([])
    }

    // ========== 返回服务实例 ==========

    return {
        id: "drawio",
        displayName: "Draw.io",

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
