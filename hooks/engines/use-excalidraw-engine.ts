"use client"

/**
 * Excalidraw 引擎 Hook
 *
 * 从 diagram-context.tsx 提取的 Excalidraw 专属逻辑
 * 负责管理 Excalidraw 画布的状态和操作
 */

import { useCallback, useRef, useState } from "react"
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types"

// 动态导入 Excalidraw 类型以避免 SSR 问题
// CaptureUpdateAction 会在运行时使用，不需要在顶层导入

// ============ 常量 ============

export const EMPTY_EXCALIDRAW_SCENE: ExcalidrawScene = {
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

// ============ 类型 ============

export interface ExcalidrawScene {
    elements: any[]
    appState?: any
    files?: Record<string, any>
}

export type ExcalidrawOperation =
    | {
          operation: "replace_elements"
          elements: any[]
      }
    | {
          operation: "patch_elements"
          elements: any[]
      }
    | {
          operation: "delete_elements"
          ids: string[]
      }

export interface UseExcalidrawEngineReturn {
    // 状态
    isReady: boolean
    setReady: (ready: boolean) => void

    // Refs
    apiRef: React.RefObject<ExcalidrawImperativeAPI | null>
    sceneRef: React.RefObject<ExcalidrawScene>
    initialDataRef: React.RefObject<ExcalidrawScene | null>

    // 场景操作
    setScene: (scene: ExcalidrawScene, options?: { 
        skipUpdateCanvas?: boolean
        /** 是否记录到 undo 栈，支持 Ctrl+Z 撤销。默认 false */
        commitToHistory?: boolean 
    }) => Promise<void>
    getScene: () => ExcalidrawScene
    clearScene: () => Promise<void>

    // 元素操作
    appendElements: (elements: any[], options?: { selectIds?: string[] }) => Promise<{ newIds: string[] }>
    editByOperations: (operations: ExcalidrawOperation[]) => Promise<{ newIds: string[] }>
    selectElements: (ids?: string[]) => void

    // 导出
    getThumbnailSvg: (elements?: any[]) => Promise<string | null>
}

// ============ 工具函数 ============

const toNumber = (val: any, fallback: number) =>
    typeof val === "number" && Number.isFinite(val) ? val : fallback

const toString = (val: any, fallback: string) =>
    typeof val === "string" ? val : fallback

/**
 * 生成 fractional index 用于元素排序
 * Excalidraw 使用 fractional indexing 来排序元素
 */
const generateFractionalIndex = (index: number): string => {
    // 简单实现：使用字母序列 a0, a1, a2, ... aA, aB, ...
    const base = "a"
    const suffix = index.toString(36).toUpperCase()
    return base + suffix
}

/**
 * 判断元素是否是已存在的完整元素（来自 Excalidraw onChange）
 * 已存在的元素有完整的版本追踪字段，且有 Excalidraw 内部生成的特征
 *
 * 关键区别：
 * - AI 生成的元素：没有 seed 或 seed 是我们生成的随机数
 * - Excalidraw 内部元素：有 seed，且 width/height 是精确测量值（小数）
 */
const isCompleteElement = (el: any): boolean => {
    // 必须有版本追踪字段
    if (
        typeof el.version !== "number" ||
        typeof el.versionNonce !== "number" ||
        typeof el.updated !== "number"
    ) {
        return false
    }

    // 文本元素：检查 width 是否是精确测量值（小数点后有多位）
    // AI 生成的文本元素 width 通常是整数（如 200, 100）
    // Excalidraw 测量的 width 是精确值（如 107.841796875）
    if (el.type === "text") {
        const width = el.width
        if (typeof width === "number" && width % 1 === 0) {
            // 整数宽度，可能是 AI 生成的，需要重新测量
            return false
        }
    }

    return true
}

/**
 * 基础字段补全（同步，用于数据合规）
 * 确保所有元素都有 Excalidraw Store 验证需要的字段
 */
export const sanitizeExcalidrawElements = (elements: any[] = []) => {
    // 类型映射：将无效类型转换为有效类型
    const TYPE_MAPPING: Record<string, string> = {
        circle: "ellipse",      // 圆形 → 椭圆
        oval: "ellipse",        // 椭圆别名
        square: "rectangle",    // 正方形 → 矩形
        box: "rectangle",       // 盒子 → 矩形
        rhombus: "diamond",     // 菱形别名
    }

    // 有效的 Excalidraw 元素类型
    const VALID_TYPES = new Set([
        "rectangle", "ellipse", "diamond", "arrow", "line",
        "text", "frame", "magicframe", "image", "freedraw",
        "embeddable", "iframe"
    ])

    return elements
        .filter((el) => el && typeof el === "object")
        .map((el, idx) => {
            // 类型修正
            let type = el.type
            if (type && TYPE_MAPPING[type]) {
                console.warn(`[sanitizeExcalidrawElements] Mapping invalid type "${type}" to "${TYPE_MAPPING[type]}"`)
                type = TYPE_MAPPING[type]
            }
            if (type && !VALID_TYPES.has(type)) {
                console.warn(`[sanitizeExcalidrawElements] Unknown type "${type}", defaulting to "rectangle"`)
                type = "rectangle"
            }

            const width = toNumber(el.width, 100)
            const height = toNumber(el.height, 60)
            const text = typeof el.text === "string" ? el.text : ""
            const id =
                typeof el.id === "string" && el.id.trim().length > 0
                    ? el.id
                    : `el-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
            const seed =
                typeof el.seed === "number" && Number.isFinite(el.seed)
                    ? el.seed
                    : Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)

            // 对于已经有完整元数据的元素(来自 Excalidraw onChange),保留其元数据
            // 只为新创建的元素(来自 AI)设置默认元数据
            const isExisting = isCompleteElement(el)

            const sanitized: any = {
                ...el,
                type, // 使用修正后的类型
                // 只为新元素设置默认元数据,已存在的元素保留原值
                version: isExisting ? el.version : (el?.version ?? 1),
                versionNonce: isExisting
                    ? el.versionNonce
                    : (el?.versionNonce ?? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
                updated: isExisting ? el.updated : (el?.updated ?? Date.now()),
                id,
                seed,
                x: toNumber(el?.x, 0),
                y: toNumber(el?.y, 0),
                width,
                height,
                angle: toNumber(el?.angle, 0),
                strokeWidth: toNumber(el?.strokeWidth, 2),
                roughness: toNumber(el?.roughness, 0),
                opacity: toNumber(el?.opacity, 100),
                strokeColor: toString(el?.strokeColor, "#1e293b"),
                backgroundColor: toString(el?.backgroundColor, "transparent"),
                fillStyle: toString(el?.fillStyle, "solid"),
                // 关键字段：Excalidraw Store 验证需要这些字段
                isDeleted: el?.isDeleted ?? false,
                strokeStyle: toString(el?.strokeStyle, "solid"),
                index: el?.index ?? generateFractionalIndex(idx),
                frameId: el?.frameId ?? null,
                link: el?.link ?? null,
                locked: el?.locked ?? false,
                groupIds: el?.groupIds ?? [],
                boundElements: el?.boundElements ?? [],
                roundness: el?.roundness ?? null,
            }

            // 文本元素特殊处理
            if (el.type === "text" || text) {
                sanitized.text = text
                sanitized.fontFamily = toNumber((el as any)?.fontFamily, 1)
                sanitized.fontSize = toNumber((el as any)?.fontSize, 20)
                sanitized.textAlign = toString((el as any)?.textAlign, "left")
                sanitized.verticalAlign = toString((el as any)?.verticalAlign, "top")
                sanitized.baseline = toNumber((el as any)?.baseline, 0)
                if (!("containerId" in sanitized)) {
                    sanitized.containerId = null
                }
                if (!("originalText" in sanitized)) {
                    sanitized.originalText = sanitized.text
                }
                if (!("autoResize" in sanitized)) {
                    sanitized.autoResize = true
                }
                if (!("lineHeight" in sanitized)) {
                    sanitized.lineHeight = 1.25
                }
            }

            // 线性元素特殊处理 (arrow, line)
            if (el.type === "arrow" || el.type === "line") {
                // 路径点
                if (!Array.isArray(sanitized.points)) {
                    sanitized.points = [[0, 0], [width, height]]
                }
                // 内部字段
                if (!("lastCommittedPoint" in sanitized)) {
                    sanitized.lastCommittedPoint = null
                }
                // 绑定字段
                if (!("startBinding" in sanitized)) {
                    sanitized.startBinding = null
                }
                if (!("endBinding" in sanitized)) {
                    sanitized.endBinding = null
                }
                // 箭头样式
                if (!("startArrowhead" in sanitized)) {
                    sanitized.startArrowhead = null
                }
                if (!("endArrowhead" in sanitized)) {
                    // arrow 类型默认有箭头，line 类型默认无
                    sanitized.endArrowhead = el.type === "arrow" ? "arrow" : null
                }
            }

            // arrow 类型额外字段
            if (el.type === "arrow") {
                if (!("elbowed" in sanitized)) {
                    sanitized.elbowed = false
                }
            }

            // line 类型额外字段
            if (el.type === "line") {
                if (!("polygon" in sanitized)) {
                    sanitized.polygon = false
                }
            }

            // frame 类型额外字段
            if (el.type === "frame" || el.type === "magicframe") {
                if (!("name" in sanitized)) {
                    sanitized.name = null
                }
            }

            // image 类型额外字段
            if (el.type === "image") {
                if (!("fileId" in sanitized)) {
                    sanitized.fileId = null
                }
                if (!("status" in sanitized)) {
                    sanitized.status = "pending"
                }
                if (!("scale" in sanitized)) {
                    sanitized.scale = [1, 1]
                }
                if (!("crop" in sanitized)) {
                    sanitized.crop = null
                }
            }

            return sanitized
        })
}

/**
 * 使用官方 API 处理新元素（异步，用于前端）
 * 自动测量文本尺寸、处理绑定等
 */
const processNewElementsWithOfficialAPI = async (elements: any[]): Promise<any[]> => {
    if (typeof window === "undefined") return elements

    // 分离已存在元素和新元素
    const existingElements: any[] = []
    const newElements: any[] = []

    elements.forEach((el) => {
        if (isCompleteElement(el)) {
            existingElements.push(el)
        } else {
            newElements.push(el)
        }
    })

    if (newElements.length === 0) {
        return elements
    }

    try {
        const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw")
        const processed = convertToExcalidrawElements(newElements, { regenerateIds: false })

        // 合并：用处理后的新元素替换原来的
        const processedMap = new Map(processed.map((el: any) => [el.id, el]))

        let result = elements.map((el) => {
            if (processedMap.has(el.id)) {
                return processedMap.get(el.id)
            }
            return el
        })

        // 修正绑定文本的位置
        result = fixBoundTextPositions(result)

        return result
    } catch (error) {
        console.warn("[processNewElementsWithOfficialAPI] Failed:", error)
        return elements
    }
}

/**
 * 修正绑定文本的位置
 * 当文本有 containerId 时，根据容器位置和对齐方式重新计算 x, y
 */
const fixBoundTextPositions = (elements: any[]): any[] => {
    // 构建元素 Map
    const elementMap = new Map<string, any>()
    elements.forEach((el) => {
        if (el?.id) elementMap.set(el.id, el)
    })

    return elements.map((el) => {
        // 只处理有 containerId 的文本元素
        if (el?.type !== "text" || !el?.containerId) {
            return el
        }

        const container = elementMap.get(el.containerId)
        if (!container) {
            // 容器不存在，清除无效的 containerId
            console.warn(`[fixBoundTextPositions] Container ${el.containerId} not found for text ${el.id}`)
            return { ...el, containerId: null }
        }

        // 跳过箭头容器（箭头的文本位置计算更复杂）
        if (container.type === "arrow" || container.type === "line") {
            return el
        }

        // 计算绑定文本的正确位置
        const { x, y } = computeBoundTextPosition(container, el)

        return { ...el, x, y }
    })
}

/**
 * 计算绑定文本在容器中的位置
 * 参考 Excalidraw 源码: packages/element/src/textElement.ts
 */
const computeBoundTextPosition = (
    container: any,
    textElement: any
): { x: number; y: number } => {
    // 容器内边距 (Excalidraw 默认值)
    const BOUND_TEXT_PADDING = 5

    // 计算容器内部可用区域
    const containerX = container.x + BOUND_TEXT_PADDING
    const containerY = container.y + BOUND_TEXT_PADDING
    const maxWidth = container.width - BOUND_TEXT_PADDING * 2
    const maxHeight = container.height - BOUND_TEXT_PADDING * 2

    const textWidth = textElement.width || 0
    const textHeight = textElement.height || 0

    let x: number
    let y: number

    // 垂直对齐
    const verticalAlign = textElement.verticalAlign || "middle"
    if (verticalAlign === "top") {
        y = containerY
    } else if (verticalAlign === "bottom") {
        y = containerY + maxHeight - textHeight
    } else {
        // middle (默认)
        y = containerY + (maxHeight - textHeight) / 2
    }

    // 水平对齐
    const textAlign = textElement.textAlign || "center"
    if (textAlign === "left") {
        x = containerX
    } else if (textAlign === "right") {
        x = containerX + maxWidth - textWidth
    } else {
        // center (默认)
        x = containerX + (maxWidth - textWidth) / 2
    }

    return { x, y }
}

const normalizeAppState = (appState?: any) => {
    // 过滤掉 appState 中的 undefined 值,避免它们覆盖默认值
    const cleanAppState: Record<string, any> = {}
    if (appState && typeof appState === "object") {
        Object.keys(appState).forEach((key) => {
            if (appState[key] !== undefined) {
                cleanAppState[key] = appState[key]
            }
        })
    }

    return {
        ...EMPTY_EXCALIDRAW_SCENE.appState,
        ...cleanAppState,
        gridSize:
            appState?.gridSize === undefined
                ? EMPTY_EXCALIDRAW_SCENE.appState?.gridSize ?? null
                : appState.gridSize,
        selectedElementIds: appState?.selectedElementIds || {},
        activeTool: appState?.activeTool || { type: "selection" },
        name: appState?.name ?? "",
    }
}

// ============ Hook ============

export function useExcalidrawEngine(): UseExcalidrawEngineReturn {
    // ========== 状态 ==========
    const [isReady, setIsReady] = useState(false)

    // ========== Refs ==========
    const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
    const sceneRef = useRef<ExcalidrawScene>(EMPTY_EXCALIDRAW_SCENE)
    const initialDataRef = useRef<ExcalidrawScene | null>(null)
    const isReadyRef = useRef(false) // 用于同步访问就绪状态

    // 初始化 initialData
    if (!initialDataRef.current) {
        initialDataRef.current = {
            ...EMPTY_EXCALIDRAW_SCENE,
            elements: [],
            appState: EMPTY_EXCALIDRAW_SCENE.appState,
            files: {},
        }
        sceneRef.current = initialDataRef.current
    }

    // ========== 就绪状态管理 ==========
    const setReady = useCallback((ready: boolean) => {
        isReadyRef.current = ready
        setIsReady(ready)
    }, [])

    // ========== 安全更新 ==========

    /**
     * 安全地更新 Excalidraw 场景
     *
     * @param api Excalidraw API
     * @param sceneData 场景数据
     * @param commitToHistory 是否记录到 undo 栈，支持 Ctrl+Z 撤销
     */
    const safeUpdateScene = useCallback(
        (api: ExcalidrawImperativeAPI, sceneData: any, commitToHistory?: boolean) => {
            if (!isReadyRef.current) {
                console.log("[useExcalidrawEngine.safeUpdateScene] Not ready, skipping")
                return false
            }
            try {
                if (commitToHistory) {
                    // 使用 IMMEDIATELY 让这次更新可以被 Ctrl+Z 撤销
                    // @ts-ignore - CaptureUpdateAction.IMMEDIATELY 的值是 "immediately"
                    api.updateScene({
                        ...sceneData,
                        captureUpdate: "immediately",
                    })
                } else {
                    // 不传 captureUpdate，使用 Excalidraw 默认行为
                    api.updateScene(sceneData)
                }
                return true
            } catch (error) {
                console.warn("[useExcalidrawEngine.safeUpdateScene] Failed:", error)
                return false
            }
        },
        []
    )

    // ========== 场景操作 ==========

    const setScene = useCallback(
        async (scene: ExcalidrawScene, options?: { 
            skipUpdateCanvas?: boolean
            /** 是否记录到 undo 栈，支持 Ctrl+Z 撤销。默认 false */
            commitToHistory?: boolean 
        }) => {
            // 1. 先用同步方法补全基础字段
            let safeElements = sanitizeExcalidrawElements(scene.elements)

            // 2. 再用官方 API 处理新元素（文本尺寸等）
            if (typeof window !== "undefined" && safeElements.length > 0) {
                safeElements = await processNewElementsWithOfficialAPI(safeElements)
            }

            const nextScene: ExcalidrawScene = {
                elements: safeElements,
                appState: normalizeAppState(scene.appState),
                files: safeElements.length === 0 ? {} : scene.files || {},
            }

            console.log("[useExcalidrawEngine.setScene]", {
                elementsCount: safeElements.length,
                hasAppState: !!scene.appState,
                hasApi: !!apiRef.current,
                isReady: isReadyRef.current,
                skipUpdate: options?.skipUpdateCanvas,
                commitToHistory: options?.commitToHistory,
            })

            sceneRef.current = nextScene
            initialDataRef.current = nextScene

            if (!options?.skipUpdateCanvas && apiRef.current) {
                safeUpdateScene(apiRef.current, nextScene, options?.commitToHistory)
            }
        },
        [safeUpdateScene]
    )

    const getScene = useCallback(() => {
        return sceneRef.current
    }, [])

    const clearScene = useCallback(async () => {
        await setScene(EMPTY_EXCALIDRAW_SCENE)
    }, [setScene])

    // ========== 元素操作 ==========

    const selectElements = useCallback(
        (ids?: string[]) => {
            if (!apiRef.current) return

            const selected =
                ids && ids.length > 0
                    ? ids.reduce<Record<string, boolean>>((acc, id) => {
                          acc[id] = true
                          return acc
                      }, {})
                    : {}

            const api = apiRef.current
            const currentAppState = api.getAppState()
            const currentSelected = currentAppState?.selectedElementIds || {}
            const sameSelection =
                Object.keys(currentSelected).length === Object.keys(selected).length &&
                Object.keys(selected).every((id) => currentSelected[id])
            const currentTool = currentAppState?.activeTool?.type

            if (sameSelection && currentTool === "selection") {
                return
            }

            safeUpdateScene(api, {
                appState: {
                    selectedElementIds: selected,
                    activeTool: { type: "selection" },
                },
            })
        },
        [safeUpdateScene]
    )

    const appendElements = useCallback(
        async (elements: any[], options?: { selectIds?: string[] }): Promise<{ newIds: string[] }> => {
            if (!apiRef.current) return { newIds: [] }

            const api = apiRef.current
            const currentElements = api.getSceneElements() || []
            const map = new Map<string, any>()

            currentElements.forEach((el: any) => {
                if (el?.id) map.set(el.id, el)
            })

            const newIds: string[] = []
            const oldIdToNewId = new Map<string, string>()
            
            // 1. 先用同步方法补全基础字段
            let incoming = sanitizeExcalidrawElements(elements)

            // 2. 再用官方 API 处理新元素（文本尺寸等）
            if (typeof window !== "undefined" && incoming.length > 0) {
                incoming = await processNewElementsWithOfficialAPI(incoming)
            }

            // 3. 为每个元素生成新的唯一ID，避免ID冲突
            incoming.forEach((el) => {
                const oldId = el?.id
                const newId = `el-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
                
                newIds.push(newId)
                if (oldId) {
                    oldIdToNewId.set(oldId, newId)
                }
                
                // 创建新元素，使用新ID
                const newElement = { ...el, id: newId }
                
                // 如果元素有 boundElements（绑定关系），需要更新引用的ID
                if (newElement.boundElements) {
                    newElement.boundElements = newElement.boundElements.map((bound: any) => ({
                        ...bound,
                        id: oldIdToNewId.get(bound.id) || bound.id
                    }))
                }
                
                // 如果是容器元素，更新 containerId
                if (newElement.containerId && oldIdToNewId.has(newElement.containerId)) {
                    newElement.containerId = oldIdToNewId.get(newElement.containerId)
                }
                
                map.set(newId, newElement)
            })

            safeUpdateScene(api, {
                elements: Array.from(map.values()),
            })

            if (options?.selectIds || newIds.length > 0) {
                selectElements(options?.selectIds || newIds)
            }

            return { newIds }
        },
        [selectElements, safeUpdateScene]
    )

    const editByOperations = useCallback(
        async (operations: ExcalidrawOperation[]): Promise<{ newIds: string[] }> => {
            if (!apiRef.current) return { newIds: [] }

            const api = apiRef.current
            let elements = [...(api.getSceneElements() || [])]
            const newIds: string[] = []

            for (const op of operations) {
                if (op.operation === "delete_elements" && op.ids) {
                    const deleteSet = new Set(op.ids)
                    elements = elements.filter((el) => !deleteSet.has(el?.id))
                } else if (
                    (op.operation === "replace_elements" || op.operation === "patch_elements") &&
                    Array.isArray((op as any).elements)
                ) {
                    // 1. 先用同步方法补全基础字段
                    let incoming = sanitizeExcalidrawElements((op as any).elements)

                    // 2. 再用官方 API 处理新元素（文本尺寸等）
                    if (typeof window !== "undefined" && incoming.length > 0) {
                        incoming = await processNewElementsWithOfficialAPI(incoming)
                    }

                    const map = new Map<string, any>()
                    elements.forEach((el) => {
                        if (el?.id) map.set(el.id, el)
                    })
                    incoming.forEach((el) => {
                        const id = el?.id
                        if (!id) return
                        const existing = map.get(id) || {}
                        const merged = op.operation === "patch_elements" ? { ...existing, ...el } : el
                        map.set(id, merged)
                        newIds.push(id)
                    })
                    elements = Array.from(map.values())
                }
            }

            safeUpdateScene(api, {
                elements,
            })

            if (newIds.length > 0) {
                selectElements(newIds)
            }

            return { newIds }
        },
        [selectElements, safeUpdateScene]
    )

    // ========== 导出 ==========

    const getThumbnailSvg = useCallback(async (elements?: any[]): Promise<string | null> => {
        const scene = sceneRef.current
        const elementsToExport = elements || scene.elements
        
        console.log("[useExcalidrawEngine.getThumbnailSvg]", {
            hasScene: !!scene,
            elementsCount: elementsToExport?.length,
            usingCustomElements: !!elements,
        })

        if (!elementsToExport || !Array.isArray(elementsToExport) || elementsToExport.length === 0) {
            console.log("[useExcalidrawEngine.getThumbnailSvg] No elements, skipping")
            return null
        }

        try {
            const { exportToSvg } = await import("@excalidraw/excalidraw")

            const svgElement = await exportToSvg({
                elements: elementsToExport,
                appState: {
                    ...scene.appState,
                    exportBackground: true,
                    exportWithDarkMode: scene.appState?.theme === "dark",
                },
                files: scene.files || {},
            })

            const svgString = new XMLSerializer().serializeToString(svgElement)
            const base64Svg = btoa(unescape(encodeURIComponent(svgString)))
            return `data:image/svg+xml;base64,${base64Svg}`
        } catch (error) {
            console.error("[useExcalidrawEngine.getThumbnailSvg] Failed:", error)
            return null
        }
    }, [])

    // ========== 返回 ==========

    return {
        // 状态
        isReady,
        setReady,

        // Refs
        apiRef,
        sceneRef,
        initialDataRef,

        // 场景操作
        setScene,
        getScene,
        clearScene,

        // 元素操作
        appendElements,
        editByOperations,
        selectElements,

        // 导出
        getThumbnailSvg,
    }
}
