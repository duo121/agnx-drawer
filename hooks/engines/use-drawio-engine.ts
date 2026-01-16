"use client"

/**
 * DrawIO 引擎 Hook
 *
 * 从 diagram-context.tsx 提取的 DrawIO 专属逻辑
 * 负责管理 DrawIO 画布的状态和操作
 */

import { useCallback, useEffect, useRef, useState } from "react"
import type { DrawIoEmbedRef } from "react-drawio"
import { toast } from "sonner"
import type { ExportFormat } from "@/components/dialog/save"
import type { DrawioHistoryEntry } from "@/hooks/session"
import { getApiEndpoint } from "@/shared/base-path"
import {
    extractDiagramXML,
    isRealDiagram,
    validateAndFixXml,
} from "@/shared/utils"

// ============ 常量 ============

const EMPTY_DIAGRAM = `<mxfile><diagram name="Page-1" id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`
const MAX_HISTORY_SIZE = 20

// ============ 类型 ============

export interface UseDrawioEngineReturn {
    // 状态
    chartXML: string
    latestSvg: string
    diagramHistory: DrawioHistoryEntry[]
    isReady: boolean

    // Refs（供组件绑定）
    drawioRef: React.RefObject<DrawIoEmbedRef | null>
    chartXMLRef: React.MutableRefObject<string>
    resolverRef: React.RefObject<((value: string) => void) | null>

    // 生命周期
    onLoad: () => void
    resetReady: () => void

    // 数据操作
    loadDiagram: (xml: string, skipValidation?: boolean) => string | null
    clearDiagram: () => void
    setDiagramHistory: (history: DrawioHistoryEntry[]) => void
    pushHistory: (isManual?: boolean) => void
    deleteHistory: (index: number) => void

    // 导出
    handleExport: () => void
    handleExportWithoutHistory: () => void
    handleDiagramExport: (data: any) => void
    handleAutoSave: (data: { xml: string }) => void
    getThumbnailSvg: () => Promise<string | null>
    saveDiagramToFile: (
        filename: string,
        format: ExportFormat,
        sessionId?: string,
        successMessage?: string,
    ) => void

    // 选择
    selectCells: (ids?: string[]) => void
}

// ============ Hook ============

export function useDrawioEngine(): UseDrawioEngineReturn {
    // ========== 状态 ==========
    const [chartXML, setChartXML] = useState<string>("")
    const [latestSvg, setLatestSvg] = useState<string>("")
    const [diagramHistory, setDiagramHistory] = useState<DrawioHistoryEntry[]>([])
    const [isReady, setIsReady] = useState(false)

    // ========== Refs ==========
    const drawioRef = useRef<DrawIoEmbedRef | null>(null)
    const chartXMLRef = useRef<string>("")
    const resolverRef = useRef<((value: string) => void) | null>(null)
    const hasCalledOnLoadRef = useRef(false)
    const hasDiagramRestoredRef = useRef(false)
    const expectHistoryExportRef = useRef(false)
    const isReadyRef = useRef(false) // 用于同步访问就绪状态
    const saveResolverRef = useRef<{
        resolver: ((data: string) => void) | null
        format: ExportFormat | null
    }>({ resolver: null, format: null })

    // ========== 生命周期 ==========

    const onLoad = useCallback(() => {
        // 防止重复触发
        if (hasCalledOnLoadRef.current) return
        hasCalledOnLoadRef.current = true
        isReadyRef.current = true
        setIsReady(true)
    }, [])

    const resetReady = useCallback(() => {
        hasCalledOnLoadRef.current = false
        hasDiagramRestoredRef.current = false
        isReadyRef.current = false
        setIsReady(false)
    }, [])

    // DrawIO 就绪后恢复图表
    useEffect(() => {
        if (!isReady) {
            console.log('[useDrawioEngine] Not ready, resetting restore flag')
            hasDiagramRestoredRef.current = false
            return
        }

        if (hasDiagramRestoredRef.current) {
            console.log('[useDrawioEngine] Already restored this cycle')
            return
        }

        hasDiagramRestoredRef.current = true

        requestAnimationFrame(() => {
            const xmlToRestore = chartXMLRef.current
            console.log('[useDrawioEngine] Checking XML for restore:', {
                hasXml: !!xmlToRestore,
                xmlLength: xmlToRestore?.length || 0,
                isRealDiagram: isRealDiagram(xmlToRestore),
                hasDrawioRef: !!drawioRef.current
            })

            if (isRealDiagram(xmlToRestore) && drawioRef.current) {
                console.log('[useDrawioEngine] Restoring diagram')
                drawioRef.current.load({ xml: xmlToRestore })
            }
        })
    }, [isReady])

    // ========== 数据操作 ==========

    const loadDiagram = useCallback((chart: string, skipValidation?: boolean): string | null => {
        let xmlToLoad = chart

        console.log('[useDrawioEngine.loadDiagram]', {
            hasDrawioRef: !!drawioRef.current,
            xmlLength: chart.length,
            skipValidation,
            isReady: isReadyRef.current
        })

        // 验证 XML
        if (!skipValidation) {
            const validation = validateAndFixXml(chart)
            if (!validation.valid) {
                console.warn('[useDrawioEngine.loadDiagram] Validation error:', validation.error)
                return validation.error
            }
            if (validation.fixed) {
                console.log('[useDrawioEngine.loadDiagram] Auto-fixed XML:', validation.fixes)
                xmlToLoad = validation.fixed
            }
        }

        // 更新状态
        setChartXML(xmlToLoad)
        chartXMLRef.current = xmlToLoad

        // 加载到 DrawIO - 使用 ref 检查就绪状态（同步访问）
        if (drawioRef.current && isReadyRef.current) {
            console.log('[useDrawioEngine.loadDiagram] Loading to DrawIO (ready)')
            drawioRef.current.load({ xml: xmlToLoad })
        } else {
            console.log('[useDrawioEngine.loadDiagram] DrawIO not ready, deferring')
            hasDiagramRestoredRef.current = false
        }

        return null
    }, [])

    const clearDiagram = useCallback(() => {
        loadDiagram(EMPTY_DIAGRAM, true)
        setLatestSvg("")
        setDiagramHistory([])
    }, [loadDiagram])

    // ========== 导出 ==========

    const handleExport = useCallback(() => {
        if (drawioRef.current) {
            expectHistoryExportRef.current = true
            console.log('[useDrawioEngine.handleExport] Triggering export for history')
            drawioRef.current.exportDiagram({ format: "xmlsvg" })
        } else {
            console.warn('[useDrawioEngine.handleExport] DrawIO ref not available')
        }
    }, [])

    const handleExportWithoutHistory = useCallback(() => {
        if (drawioRef.current) {
            drawioRef.current.exportDiagram({ format: "xmlsvg" })
        }
    }, [])

    const handleDiagramExport = useCallback((data: any) => {
        console.log('[useDrawioEngine.handleDiagramExport] Export received:', {
            timestamp: Date.now(),
            hasSaveResolver: !!saveResolverRef.current.resolver,
            expectHistoryExport: expectHistoryExportRef.current,
            hasResolver: !!resolverRef.current
        })

        // 处理文件保存
        if (saveResolverRef.current.resolver) {
            const format = saveResolverRef.current.format
            saveResolverRef.current.resolver(data.data)
            saveResolverRef.current = { resolver: null, format: null }
            if (format === "png" || format === "svg") {
                return
            }
        }

        const extractedXML = extractDiagramXML(data.data)

        // 如果有 resolver（如 getThumbnailSvg），只更新 SVG，不更新 XML
        // 因为 handleAutoSave 已经实时更新了 chartXML，这里不应该覆盖
        const isForThumbnail = !!resolverRef.current
        
        // 只有真实图表且不是为了获取缩略图时才更新 XML 状态
        const isReal = isRealDiagram(extractedXML)
        if (isReal && !isForThumbnail) {
            setChartXML(extractedXML)
            chartXMLRef.current = extractedXML
        } else if (!isReal) {
            console.log('[useDrawioEngine.handleDiagramExport] Skipping XML update - not a real diagram')
        } else {
            console.log('[useDrawioEngine.handleDiagramExport] Skipping XML update - thumbnail export')
        }
        setLatestSvg(data.data)

        // 保存到历史
        const shouldSaveToHistory = expectHistoryExportRef.current || !resolverRef.current

        if (shouldSaveToHistory && isReal) {
            console.log('[useDrawioEngine.handleDiagramExport] Saving to history')
            setDiagramHistory((prev) => {
                const newEntry: DrawioHistoryEntry = {
                    svg: data.data,
                    xml: extractedXML,
                    timestamp: Date.now(),
                    isManual: false,
                }
                const newHistory = [...prev, newEntry]
                // 只限制自动保存的数量
                const autoEntries = newHistory.filter(e => !e.isManual)
                const manualEntries = newHistory.filter(e => e.isManual)
                if (autoEntries.length > MAX_HISTORY_SIZE) {
                    const trimmedAuto = autoEntries.slice(-MAX_HISTORY_SIZE)
                    return [...trimmedAuto, ...manualEntries].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
                }
                return newHistory
            })
        }

        // 重置标志
        if (expectHistoryExportRef.current) {
            expectHistoryExportRef.current = false
        }

        // 处理 resolver
        if (resolverRef.current) {
            resolverRef.current(extractedXML)
            resolverRef.current = null
        }
    }, [])

    const getThumbnailSvg = useCallback(async (): Promise<string | null> => {
        if (!drawioRef.current) return null
        if (!isRealDiagram(chartXMLRef.current)) return null

        try {
            const svgData = await Promise.race([
                new Promise<string>((resolve) => {
                    resolverRef.current = resolve
                    drawioRef.current?.exportDiagram({ format: "xmlsvg" })
                }),
                new Promise<string>((_, reject) =>
                    setTimeout(() => reject(new Error("Export timeout")), 3000)
                ),
            ])

            if (svgData?.includes("<svg")) {
                setLatestSvg(svgData)
                return svgData
            }
            return null
        } catch {
            return null
        }
    }, [])

    const saveDiagramToFile = useCallback((
        filename: string,
        format: ExportFormat,
        sessionId?: string,
        successMessage?: string,
    ) => {
        if (!drawioRef.current) {
            console.warn('[useDrawioEngine.saveDiagramToFile] DrawIO not ready')
            return
        }

        const drawioFormat = format === "drawio" ? "xmlsvg" : format

        saveResolverRef.current = {
            resolver: (exportData: string) => {
                let fileContent: string | Blob
                let mimeType: string
                let extension: string

                if (format === "drawio") {
                    const xml = extractDiagramXML(exportData)
                    let xmlContent = xml
                    if (!xml.includes("<mxfile")) {
                        xmlContent = `<mxfile><diagram name="Page-1" id="page-1">${xml}</diagram></mxfile>`
                    }
                    fileContent = xmlContent
                    mimeType = "application/xml"
                    extension = ".drawio"
                } else if (format === "png") {
                    fileContent = exportData
                    mimeType = "image/png"
                    extension = ".png"
                } else {
                    fileContent = exportData
                    mimeType = "image/svg+xml"
                    extension = ".svg"
                }

                // 记录到 Langfuse
                logSaveToLangfuse(filename, format, sessionId)

                // 下载文件
                let url: string
                if (typeof fileContent === "string" && fileContent.startsWith("data:")) {
                    url = fileContent
                } else {
                    const blob = new Blob([fileContent], { type: mimeType })
                    url = URL.createObjectURL(blob)
                }

                const a = document.createElement("a")
                a.href = url
                a.download = `${filename}${extension}`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)

                if (successMessage) {
                    toast.success(successMessage, {
                        position: "bottom-left",
                        duration: 2500,
                    })
                }

                if (!url.startsWith("data:")) {
                    setTimeout(() => URL.revokeObjectURL(url), 100)
                }
            },
            format,
        }

        drawioRef.current.exportDiagram({ format: drawioFormat })
    }, [])

    // ========== 选择 ==========

    const selectCells = useCallback((ids?: string[]) => {
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
            console.warn('[useDrawioEngine.selectCells] Failed:', error)
        }
    }, [])

    // ========== 历史操作 ==========

    const pushHistory = useCallback((isManual?: boolean) => {
        if (!latestSvg || !isRealDiagram(chartXMLRef.current)) {
            console.warn('[useDrawioEngine.pushHistory] No valid diagram to save')
            return
        }

        const newEntry: DrawioHistoryEntry = {
            svg: latestSvg,
            xml: chartXMLRef.current,
            timestamp: Date.now(),
            isManual: isManual ?? false,
        }

        setDiagramHistory((prev) => {
            const newHistory = [...prev, newEntry]
            // 只限制自动保存的数量
            const autoEntries = newHistory.filter(e => !e.isManual)
            const manualEntries = newHistory.filter(e => e.isManual)
            if (autoEntries.length > MAX_HISTORY_SIZE) {
                const trimmedAuto = autoEntries.slice(-MAX_HISTORY_SIZE)
                return [...trimmedAuto, ...manualEntries].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
            }
            return newHistory
        })
    }, [latestSvg])

    const deleteHistory = useCallback((index: number) => {
        setDiagramHistory((prev) => {
            if (index < 0 || index >= prev.length) {
                console.warn('[useDrawioEngine.deleteHistory] Invalid index:', index)
                return prev
            }
            return prev.filter((_, i) => i !== index)
        })
    }, [])

    // ========== AutoSave 处理 ==========

    /**
     * 处理 DrawIO 的 autosave 事件
     * 当用户在画布上进行任何操作时触发，用于实时同步 XML 状态
     * 
     * 注意：onAutoSave 返回的 xml 是原始 mxGraphModel XML，不是 base64 编码的 SVG
     * 所以不需要通过 extractDiagramXML 处理
     */
    const handleAutoSave = useCallback((data: { xml: string }) => {
        const xml = data.xml
        if (!xml) return

        // onAutoSave 返回的是原始 XML，直接验证即可
        const isReal = isRealDiagram(xml)

        console.log('[useDrawioEngine.handleAutoSave]', {
            isReal,
            xmlLength: xml.length,
            prevXmlLength: chartXMLRef.current.length,
        })

        // 只有真实图表才更新状态
        if (isReal) {
            // 检查是否有实际变化（避免无意义的更新）
            if (xml !== chartXMLRef.current) {
                setChartXML(xml)
                chartXMLRef.current = xml
            }
        }
    }, [])

    // ========== 返回 ==========

    return {
        // 状态
        chartXML,
        latestSvg,
        diagramHistory,
        isReady,

        // Refs
        drawioRef,
        chartXMLRef,
        resolverRef,

        // 生命周期
        onLoad,
        resetReady,

        // 数据操作
        loadDiagram,
        clearDiagram,
        setDiagramHistory,
        pushHistory,
        deleteHistory,

        // 导出
        handleExport,
        handleExportWithoutHistory,
        handleDiagramExport,
        handleAutoSave,
        getThumbnailSvg,
        saveDiagramToFile,

        // 选择
        selectCells,
    }
}

// ============ 工具函数 ============

async function logSaveToLangfuse(filename: string, format: string, sessionId?: string) {
    try {
        await fetch(getApiEndpoint("/api/log-save"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename, format, sessionId }),
        })
    } catch (error) {
        console.warn("Failed to log save to Langfuse:", error)
    }
}
