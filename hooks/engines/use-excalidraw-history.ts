"use client"

/**
 * Excalidraw 历史记录 Hook
 *
 * 管理 Excalidraw 场景的版本历史，支持：
 * - 添加历史记录（手动/自动）
 * - 恢复到指定版本
 * - 历史记录数量限制
 */

import { useCallback, useRef, useState } from "react"
import type { ExcalidrawScene, ExcalidrawHistoryEntry } from "@/hooks/session"

// ============ 常量 ============

const MAX_HISTORY_ENTRIES = 20
const MAX_SCENE_SIZE_FOR_FILES = 1024 * 1024 // 1MB

// ============ 类型 ============

export interface UseExcalidrawHistoryOptions {
    /** 获取当前场景的函数 */
    getScene: () => ExcalidrawScene
    /** 设置场景的函数 */
    setScene: (scene: ExcalidrawScene) => void
    /** 获取缩略图的函数 */
    getThumbnailSvg?: (elements?: any[]) => Promise<string | null>
    /** 历史变更回调 */
    onHistoryChange?: (history: ExcalidrawHistoryEntry[]) => void
}

export interface UseExcalidrawHistoryReturn {
    /** 历史记录列表 */
    history: ExcalidrawHistoryEntry[]
    /** 当前版本索引（-1 表示最新状态） */
    currentIndex: number
    /** 添加历史记录 */
    pushHistory: (label?: string, isManual?: boolean) => Promise<void>
    /** 恢复到指定版本 */
    restoreVersion: (index: number) => void
    /** 删除指定版本（仅手动保存的可删除） */
    deleteVersion: (index: number) => void
    /** 清空历史 */
    clearHistory: () => void
    /** 初始化历史（从存储加载） */
    initHistory: (entries: ExcalidrawHistoryEntry[]) => void
    /** 获取历史记录（用于保存） */
    getHistory: () => ExcalidrawHistoryEntry[]
    /** 是否可以撤销到上一个版本 */
    canUndo: boolean
    /** 撤销到上一个版本 */
    undo: () => void
}

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
        // 保留 files 的引用但不保存实际数据
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

// ============ Hook ============

export function useExcalidrawHistory(
    options: UseExcalidrawHistoryOptions
): UseExcalidrawHistoryReturn {
    const { getScene, setScene, getThumbnailSvg, onHistoryChange } = options

    // ========== 状态 ==========
    const [history, setHistory] = useState<ExcalidrawHistoryEntry[]>([])
    const [currentIndex, setCurrentIndex] = useState(-1) // -1 表示最新状态

    // 使用 ref 避免闭包问题
    const historyRef = useRef<ExcalidrawHistoryEntry[]>([])
    historyRef.current = history

    // ========== 历史操作 ==========

    const pushHistory = useCallback(
        async (label?: string, isManual?: boolean) => {
            const scene = getScene()

            // 空场景不保存
            if (!scene.elements || scene.elements.length === 0) {
                return
            }

            // 检查是否有选中的元素
            const selectedIds = scene.appState?.selectedElementIds || {}
            const selectedElementIds = Object.keys(selectedIds).filter(id => selectedIds[id])
            
            // 如果有选中元素，只保存选中的；否则保存全部
            let elementsToSave = scene.elements
            if (selectedElementIds.length > 0) {
                elementsToSave = scene.elements.filter(el => selectedElementIds.includes(el.id))
                console.log(`[useExcalidrawHistory] Saving ${elementsToSave.length} selected elements out of ${scene.elements.length} total`)
            }

            // 生成缩略图 - 只为要保存的元素生成
            let thumbnailDataUrl: string | undefined
            if (getThumbnailSvg) {
                try {
                    const svg = await getThumbnailSvg(elementsToSave)
                    if (svg) {
                        thumbnailDataUrl = svg
                    }
                } catch (error) {
                    console.warn("[useExcalidrawHistory] Failed to generate thumbnail:", error)
                }
            }

            const entry: ExcalidrawHistoryEntry = {
                timestamp: Date.now(),
                label,
                scene: sanitizeSceneForStorage(cloneScene({
                    ...scene,
                    elements: elementsToSave
                })),
                thumbnailDataUrl,
                isManual,
            }

            setHistory((prev) => {
                let newHistory = [...prev, entry]

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

                historyRef.current = newHistory
                onHistoryChange?.(newHistory)
                return newHistory
            })

            // 重置当前索引到最新
            setCurrentIndex(-1)
        },
        [getScene, getThumbnailSvg, onHistoryChange]
    )

    const restoreVersion = useCallback(
        (index: number) => {
            const entries = historyRef.current
            if (index < 0 || index >= entries.length) {
                console.warn("[useExcalidrawHistory] Invalid index:", index)
                return
            }

            const entry = entries[index]
            if (!entry?.scene) {
                console.warn("[useExcalidrawHistory] Invalid entry at index:", index)
                return
            }

            // 恢复场景
            setScene(cloneScene(entry.scene))
            setCurrentIndex(index)
        },
        [setScene]
    )

    const deleteVersion = useCallback(
        (index: number) => {
            const entries = historyRef.current
            if (index < 0 || index >= entries.length) {
                console.warn("[useExcalidrawHistory] Invalid index for delete:", index)
                return
            }

            setHistory((prev) => {
                const newHistory = prev.filter((_, i) => i !== index)
                historyRef.current = newHistory
                onHistoryChange?.(newHistory)
                return newHistory
            })

            // 如果删除的是当前选中的版本，重置索引
            if (currentIndex === index) {
                setCurrentIndex(-1)
            } else if (currentIndex > index) {
                setCurrentIndex(currentIndex - 1)
            }
        },
        [currentIndex, onHistoryChange]
    )

    const clearHistory = useCallback(() => {
        setHistory([])
        setCurrentIndex(-1)
        historyRef.current = []
        onHistoryChange?.([])
    }, [onHistoryChange])

    const initHistory = useCallback(
        (entries: ExcalidrawHistoryEntry[]) => {
            const validEntries = entries.filter(
                (e) => e && e.timestamp && e.scene && Array.isArray(e.scene.elements)
            )
            setHistory(validEntries)
            historyRef.current = validEntries
            setCurrentIndex(-1)
        },
        []
    )

    const getHistory = useCallback(() => {
        return historyRef.current
    }, [])

    // ========== 撤销功能 ==========

    const canUndo = history.length > 0

    const undo = useCallback(() => {
        const entries = historyRef.current
        if (entries.length === 0) return

        // 如果当前在最新状态，先保存当前状态
        if (currentIndex === -1) {
            // 恢复到最后一个历史版本
            restoreVersion(entries.length - 1)
        } else if (currentIndex > 0) {
            // 恢复到上一个版本
            restoreVersion(currentIndex - 1)
        }
    }, [currentIndex, restoreVersion])

    // ========== 返回 ==========

    return {
        history,
        currentIndex,
        pushHistory,
        restoreVersion,
        deleteVersion,
        clearHistory,
        initHistory,
        getHistory,
        canUndo,
        undo,
    }
}
