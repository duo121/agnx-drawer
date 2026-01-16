"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useEngine, EMPTY_EXCALIDRAW_SCENE, sanitizeExcalidrawElements } from "@/hooks/engines/engine-context"

// Use built CSS from package; min.css not published in v0.18
// Use package export map to pick correct env-specific CSS
import "@excalidraw/excalidraw/index.css"

const ExcalidrawComp =
    dynamic(
        () =>
            import("@excalidraw/excalidraw").then(
                (mod) => mod.Excalidraw,
            ) as any,
        { ssr: false },
    ) as any

const getDefaultTheme = (): "dark" | "light" => {
    if (typeof document !== "undefined") {
        return document.documentElement.classList.contains("dark")
            ? "dark"
            : "light"
    }
    return "light"
}

export function ExcalidrawCanvas() {
    const {
        excalidrawApiRef,
        excalidrawSceneRef,
        initialDataRef,
        setExcalidrawReady,
    } = useEngine()

    // 追踪上次应用的数据版本，防止重复更新
    const lastAppliedVersionRef = useRef<number | null>(null)
    
    // 监听 document dark class 变化，同步到 Excalidraw
    const [theme, setTheme] = useState<"dark" | "light">(getDefaultTheme)

    const normalizeAppState = useCallback((appState?: any) => {
        const nextState = {...(appState || {})} as any
        const collaborators = nextState.collaborators
        if (!collaborators || typeof collaborators.forEach !== "function") {
            nextState.collaborators = new Map()
        }
        return nextState
    }, [])

    // 计算 initialData - 与 packages/excalidraw 相同的模式
    // 使用 useMemo 确保只在 initialDataRef.current 变化时重新计算
    const initialData = useMemo(() => {
        const data = initialDataRef.current
        if (!data || !data.elements || data.elements.length === 0) {
            return undefined
        }
        return {
            elements: data.elements,
            appState: normalizeAppState(data.appState),
            files: data.files,
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [normalizeAppState])

    // 后续数据更新（会话切换等）- 与 packages/excalidraw 相同的模式
    useEffect(() => {
        const api = excalidrawApiRef.current
        const data = initialDataRef.current
        if (!api || !data) return

        // 使用元素数量 + 第一个元素的 id 作为简单的版本标识
        const version = data.elements?.length ?? 0
        if (lastAppliedVersionRef.current === version && version === 0) return

        // 只在有实际数据变化时更新
        if (data.elements && data.elements.length > 0) {
            const nextAppState = normalizeAppState(data.appState || {})
            api.updateScene({
                elements: data.elements,
                appState: nextAppState,
            })
            lastAppliedVersionRef.current = version
            console.log('[ExcalidrawCanvas] Scene updated via useEffect:', {
                elementsCount: data.elements.length
            })
        }
    }, [excalidrawApiRef, initialDataRef, normalizeAppState])

    // Watch theme class changes - 更新 state 让 Excalidraw 通过 prop 响应
    useEffect(() => {
        if (typeof document === "undefined") return
        const observer = new MutationObserver(() => {
            const newTheme = getDefaultTheme()
            setTheme(newTheme)
        })
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        })
        return () => observer.disconnect()
    }, [])

    const handleExcalidrawAPI = useCallback((api: any) => {
        if (excalidrawApiRef.current === api) return
        excalidrawApiRef.current = api
        if (api) {
            setExcalidrawReady(true)
            console.log('[ExcalidrawCanvas] API ready, theme:', theme)
        }
    }, [excalidrawApiRef, setExcalidrawReady, theme])

    const handleChange = useCallback(
        (elements: any[], appState: any, files: Record<string, any>) => {
            // 只保存到 ref，不触发重新渲染
            const safeElements = sanitizeExcalidrawElements(elements)

            excalidrawSceneRef.current = {
                elements: safeElements,
                appState: appState,
                files: files || {},
            }

            // 注意：不要在 onChange 中同步主题到 document
            // 因为 Excalidraw 初始化时可能使用默认主题，会覆盖用户的 dark mode 设置
            // 主题同步应该由 MutationObserver 反向处理（document -> Excalidraw）
        },
        [excalidrawSceneRef],
    )

    // 使用 theme prop 控制主题
    return (
        <ExcalidrawComp
            excalidrawAPI={handleExcalidrawAPI}
            initialData={initialData}
            onChange={handleChange}
            viewModeEnabled={false}
            theme={theme}
        />
    )
}
