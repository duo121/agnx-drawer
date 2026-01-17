"use client"

import {
    MessageSquarePlus,
    PanelRightClose,
    PanelRightOpen,
    Moon,
    Sun,
    Languages,
    Palette,
    Github,
    Zap,
    Sparkles,
} from "lucide-react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import type React from "react"
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { Toaster, toast } from "sonner"
import { ButtonWithTooltip } from "@/components/button-with-tooltip"
import { HeaderActionButton } from "@/components/header-action-button"
import { ChatInput, type ChatInputRef } from "./input"
import { ModelConfigDialog } from "@/components/model/config-dialog"
import { i18n, type Locale } from "@/shared/i18n/config"
import { useEngine, type ExcalidrawScene, EMPTY_EXCALIDRAW_SCENE } from "@/hooks/engines/engine-context"
import { useDiagramToolHandlers } from "@/hooks/use-diagram-tool-handlers"
import { useDictionary } from "@/hooks/use-dictionary"
import { useModelConfig } from "@/hooks/use-model-config"
import { useAgent, type AgentErrorType } from "@/hooks/use-agent"
import { useSessionManager } from "@/hooks/session"
import { getApiEndpoint } from "@/shared/base-path"
import { findCachedResponse } from "@/server/cached-responses"
import { formatMessage } from "@/shared/i18n/utils"
import { isPdfFile, isTextFile, type UrlData } from "@/shared/extract-content"
import { sanitizeMessages, type ExcalidrawHistoryEntry } from "@/hooks/session"
import { type FileData, useFileProcessor } from "@/hooks/use-file-processor"
import { useQuotaManager } from "@/hooks/use-quota-manager"
import { cn, formatXML, isRealDiagram } from "@/shared/utils"
import { ChatMessageDisplay } from "./message-display"

// localStorage keys for persistence
const STORAGE_SESSION_ID_KEY = "agnx-session-id"

// sessionStorage keys
const SESSION_STORAGE_INPUT_KEY = "agnx-input"

interface ChatPanelProps {
    isVisible: boolean
    onToggleVisibility: () => void
    drawioUi: "min" | "sketch"
    onToggleDrawioUi: () => void
    darkMode: boolean
    onToggleDarkMode: () => void
    isMobile?: boolean
}

// Constants
const MAX_AUTO_RETRY_COUNT = 1
const MAX_CONTINUATION_RETRY_COUNT = 2 // Limit for truncation continuation retries
const DEFAULT_ENGINE_ID = "excalidraw"
const ENGINE_STORAGE_KEY = "agnx-drawer-engine"
const HISTORY_STORAGE_KEY = "agnx-drawer-input-history"
const ENGINE_DISPLAY_NAME: Record<string, string> = {
    drawio: "Drawio",
    excalidraw: "Excalidraw",
}
const LANGUAGE_LABELS: Record<Locale, string> = {
    en: "English",
    zh: "中文",
}
const IS_DEV = process.env.NODE_ENV === "development"
const debugLog = (...args: any[]) => {
    if (IS_DEV) {
        // eslint-disable-next-line no-console
        console.debug("[ChatPanel]", ...args)
    }
}

export default function ChatPanel({
    isVisible,
    onToggleVisibility,
    drawioUi,
    onToggleDrawioUi,
    darkMode,
    onToggleDarkMode,
    isMobile = false,
}: ChatPanelProps) {
    const {
        loadDiagram: onDisplayChart,
        handleExport: onExport,
        handleExportWithoutHistory,
        resolverRef,
        chartXML,
        latestSvg,
        clearDiagram,
        getThumbnailSvg,
        diagramHistory,
        setDiagramHistory,
        selectCells,
        engineId: diagramEngineId,
        setEngineId: setDiagramEngineId,
        getExcalidrawScene,
        setExcalidrawScene,
        appendExcalidrawElements,
        editExcalidrawByOperations,
        selectExcalidrawElements,
        pushExcalidrawHistory,
        isDrawioReady,
        resetDrawioReady,
        // 使用 context 的 chartXMLRef（同步更新），而不是本地 ref（通过 useEffect 异步同步）
        chartXMLRef,
        // Excalidraw 历史记录
        getExcalidrawHistory,
        initExcalidrawHistory,
        // 画布版本计数器（用于触发 auto-save）
        canvasVersion,
    } = useEngine()

    const dict = useDictionary()
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'
    const urlSessionId = searchParams.get("session")
    const chatInputRef = useRef<ChatInputRef>(null)
    
    // Detect current language from pathname
    const [currentLang, setCurrentLang] = useState<Locale>(() => {
        if (typeof window === 'undefined') return i18n.defaultLocale
        const seg = window.location.pathname.split("/").filter(Boolean)
        const first = seg[0]
        if (first && i18n.locales.includes(first as Locale)) {
            return first as Locale
        }
        return i18n.defaultLocale
    })

    const onFetchChart = (saveToHistory = true) => {
        // Excalidraw 不依赖 draw.io 导出，直接返回空字符串
        if (activeEngine === "excalidraw") {
            return Promise.resolve("")
        }
        if (!isDrawioReady) {
            return Promise.reject(
                new Error("Draw.io 未就绪，无法导出当前画布"),
            )
        }
        return Promise.race([
            new Promise<string>((resolve) => {
                if (resolverRef && "current" in resolverRef) {
                    resolverRef.current = resolve
                }
                if (saveToHistory) {
                    onExport()
                } else {
                    handleExportWithoutHistory()
                }
            }),
            new Promise<string>((_, reject) =>
                setTimeout(
                    () =>
                        reject(
                            new Error(
                                "Chart export timed out after 10 seconds",
                            ),
                        ),
                    10000,
                ),
            ),
        ])
    }

    // File processing using extracted hook
    const { files, pdfData, handleFileChange, setFiles } = useFileProcessor()
    const [urlData, setUrlData] = useState<Map<string, UrlData>>(new Map())
    // Use diagram context's engineId as the source of truth
    const activeEngine = diagramEngineId || DEFAULT_ENGINE_ID
    const prevEngineRef = useRef<string>(diagramEngineId || DEFAULT_ENGINE_ID)
    const [
        startNewChatAfterEngineSwitch,
        setStartNewChatAfterEngineSwitch,
    ] = useState(false)
    const pendingSessionToOpenRef = useRef<string | null>(null)
    
    // 引擎切换锁，防止竞态条件
    const engineSwitchInProgressRef = useRef(false)

    const [showModelConfigDialog, setShowModelConfigDialog] = useState(false)

    // Model configuration hook
    const modelConfig = useModelConfig()

    // Session manager for chat history (pass URL session ID for restoration)
    const savedSessionId = useMemo(() => {
        if (typeof window === "undefined") return null
        return localStorage.getItem(STORAGE_SESSION_ID_KEY)
    }, [])

    const sessionManager = useSessionManager({
        initialSessionId: urlSessionId || savedSessionId || undefined,
        engineId: activeEngine,
    })

    const [input, setInput] = useState("")
    
    // Ensure input is always a string (never undefined)
    const safeInput = input ?? ""
    const [inputHistory, setInputHistory] = useState<string[]>([])
    const [historyIndex, setHistoryIndex] = useState<number | null>(null)
    const [dailyRequestLimit, setDailyRequestLimit] = useState(0)
    const [dailyTokenLimit, setDailyTokenLimit] = useState(0)
    const [tpmLimit, setTpmLimit] = useState(0)
    const [minimalStyle, setMinimalStyle] = useState(false)

    // Restore input from sessionStorage on mount
    useEffect(() => {
        const savedInput = sessionStorage.getItem(SESSION_STORAGE_INPUT_KEY)
        if (savedInput) {
            setInput(savedInput)
        }

        // Restore engine preference
        const savedEngine =
            typeof window !== "undefined"
                ? localStorage.getItem(ENGINE_STORAGE_KEY)
                : null
        if (savedEngine === "drawio" || savedEngine === "excalidraw") {
            debugLog("restore engine", savedEngine)
            setDiagramEngineId(savedEngine)
            prevEngineRef.current = savedEngine
        }
    }, [])

    // Load input history on mount (shared across all engines)
    useEffect(() => {
        try {
            const stored = sessionStorage.getItem(HISTORY_STORAGE_KEY)
            const parsed = stored ? (JSON.parse(stored) as string[]) : []
            setInputHistory(Array.isArray(parsed) ? parsed : [])
        } catch {
            setInputHistory([])
        }
        setHistoryIndex(null)
    }, [])

    // Check config on mount
    useEffect(() => {
        fetch(getApiEndpoint("/api/config"))
            .then((res) => res.json())
            .then((data) => {
                setDailyRequestLimit(data.dailyRequestLimit || 0)
                setDailyTokenLimit(data.dailyTokenLimit || 0)
                setTpmLimit(data.tpmLimit || 0)
            })
            .catch(() => {})
    }, [])

    // 仅在引擎变化时同步 localStorage，清除逻辑移到 onClick 中统一处理
    useEffect(() => {
        if (prevEngineRef.current === activeEngine) return
        prevEngineRef.current = activeEngine
        // 只同步 localStorage，不执行清除操作（避免与 onClick 中的逻辑竞争）
        if (typeof window !== "undefined") {
            localStorage.setItem(ENGINE_STORAGE_KEY, activeEngine)
        }
        // 刷新会话列表以显示对应引擎的会话
        sessionManager.refreshSessions()
    }, [activeEngine, sessionManager])

    // Quota management using extracted hook
    const quotaManager = useQuotaManager({
        dailyRequestLimit,
        dailyTokenLimit,
        tpmLimit,
        onConfigModel: () => setShowModelConfigDialog(true),
    })

    // Generate a unique session ID for Langfuse tracing (restore from localStorage if available)
    const [sessionId, setSessionId] = useState(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem(STORAGE_SESSION_ID_KEY)
            if (saved) return saved
        }
        return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    })

    // Flag to track if we've restored from localStorage
    const hasRestoredRef = useRef(false)
    const [isRestored, setIsRestored] = useState(false)

    // Track previous isVisible to only animate when toggling (not on page load)
    const prevIsVisibleRef = useRef(isVisible)
    const [shouldAnimatePanel, setShouldAnimatePanel] = useState(false)
    useEffect(() => {
        // Only animate when visibility changes from false to true (not on initial load)
        if (!prevIsVisibleRef.current && isVisible) {
            setShouldAnimatePanel(true)
        }
        prevIsVisibleRef.current = isVisible
    }, [isVisible])

    // chartXMLRef 现在从 context 获取，不再维护本地 ref（解决 React state 异步更新导致的数据丢失问题）
    // Track session ID that was loaded without a diagram (to prevent thumbnail contamination)
    const justLoadedSessionIdRef = useRef<string | null>(null)
    useEffect(() => {
        // Clear the no-diagram flag when a diagram is generated
        if (chartXML) {
            justLoadedSessionIdRef.current = null
        }
    }, [chartXML])

    // Ref to track latest SVG for thumbnail generation
    const latestSvgRef = useRef(latestSvg)
    useEffect(() => {
        latestSvgRef.current = latestSvg
    }, [latestSvg])

    // Ref to accumulate partial XML when output is truncated due to maxOutputTokens
    // When partialXmlRef.current.length > 0, we're in continuation mode
    const partialXmlRef = useRef<string>("")

    // Persist processed tool call IDs so collapsing the chat doesn't replay old tool outputs
    const processedToolCallsRef = useRef<Set<string>>(new Set())

    // Store original XML for edit_drawio streaming - shared between streaming preview and tool handler
    // Key: toolCallId, Value: original XML before any operations applied
    const editDiagramOriginalXmlRef = useRef<Map<string, string>>(new Map())

    // Debounce timeout for localStorage writes (prevents blocking during streaming)
    const localStorageDebounceRef = useRef<ReturnType<
        typeof setTimeout
    > | null>(null)
    const LOCAL_STORAGE_DEBOUNCE_MS = 1000 // Save at most once per second

    // Diagram tool handlers (display_drawio, edit_drawio, append_drawio)
    const { handleToolCall } = useDiagramToolHandlers({
        partialXmlRef,
        editDiagramOriginalXmlRef,
        chartXMLRef,
        onDisplayChart,
        onFetchChart,
        onExport,
        onSelectCells: selectCells,
        getExcalidrawScene,
        setExcalidrawScene,
        appendExcalidrawElements,
        editExcalidrawByOperations,
        selectExcalidrawElements,
        pushExcalidrawHistory,
        onSwitchCanvas: (target, reason) => {
            setDiagramEngineId(target)
            // if (reason) {
            //     toast.info(`Switched to ${ENGINE_DISPLAY_NAME[target] || target}: ${reason}`)
            // }
        },
    })

    // External error handler for useAgent (handles quota, network errors, etc.)
    const handleExternalError = useCallback((error: Error, type: AgentErrorType) => {
        // Handle server-side quota limit (429 response)
        // AI SDK puts the full response body in error.message for non-OK responses
        if (type === 'quota') {
            try {
                const data = JSON.parse(error.message)
                if (data.type === "request") {
                    quotaManager.showQuotaLimitToast(data.used, data.limit)
                    return
                }
                if (data.type === "token") {
                    quotaManager.showTokenLimitToast(data.used, data.limit)
                    return
                }
                if (data.type === "tpm") {
                    quotaManager.showTPMLimitToast(data.limit)
                    return
                }
            } catch {
                // Not JSON, fall through to string matching
            }

            // Fallback to string matching
            if (error.message.includes("Daily request limit")) {
                quotaManager.showQuotaLimitToast()
                return
            }
            if (error.message.includes("Daily token limit")) {
                quotaManager.showTokenLimitToast()
                return
            }
            if (
                error.message.includes("Rate limit exceeded") ||
                error.message.includes("tokens per minute")
            ) {
                quotaManager.showTPMLimitToast()
                return
            }
        }

        // Silence access code error in console since it's handled by UI
        if (!error.message.includes("Invalid or missing access code")) {
            console.error("Chat error:", error)
        }

        // Translate technical errors into user-friendly messages
        let friendlyMessage = error.message

        // Simple check for network errors if message is generic
        if (friendlyMessage === "Failed to fetch") {
            friendlyMessage = "Network error. Please check your connection."
        }

        // Truncated tool input error (model output limit too low)
        if (friendlyMessage.includes("toolUse.input is invalid")) {
            friendlyMessage =
                "Output was truncated before the diagram could be generated. Try a simpler request or increase the maxOutputLength."
        }

        // Translate image not supported error
        if (
            friendlyMessage.includes("image content block") ||
            friendlyMessage.toLowerCase().includes("image_url")
        ) {
            friendlyMessage = "This model doesn't support image input."
        }

        // Add system message for error so it can be cleared
        // Note: we need to get current messages and append error message
        if (agentSetMessagesRef.current && agentMessagesRef.current) {
            const errorMessage = {
                id: `error-${Date.now()}`,
                role: "system" as const,
                content: friendlyMessage,
                parts: [
                    { type: "text" as const, text: friendlyMessage },
                ],
            }
            agentSetMessagesRef.current([...agentMessagesRef.current, errorMessage])
        }
    }, [quotaManager])

    // Retry limit reached handler
    const handleRetryLimitReached = useCallback((context: { type: 'auto' | 'continuation'; count: number; max: number }) => {
        if (context.type === 'continuation') {
            toast.error(
                formatMessage(dict.errors.continuationRetryLimit, {
                    max: context.max,
                }),
            )
        } else {
            toast.error(
                formatMessage(dict.errors.retryLimit, {
                    max: context.max,
                }),
            )
        }
    }, [dict.errors.continuationRetryLimit, dict.errors.retryLimit])

    // Refs to hold setMessages and messages from agent (for error handler)
    const agentSetMessagesRef = useRef<((messages: any[]) => void) | null>(null)
    const agentMessagesRef = useRef<any[]>([])

    // Get current canvas state for regenerate/edit operations
    const getCurrentStateForAgent = useCallback(async () => {
        try {
            const xml = await onFetchChart(false)
            return xml || chartXMLRef.current || ''
        } catch {
            return chartXMLRef.current || ''
        }
    }, [onFetchChart, chartXMLRef])

    // useAgent - the main AI agent hook
    const {
        messages,
        sendMessage: agentSendMessage,
        addToolOutput,
        status,
        error,
        setMessages,
        stop,
        isProcessing,
        regenerate: agentRegenerate,
        editMessage: agentEditMessage,
        deleteMessage: agentDeleteMessage,
    } = useAgent({
        engineId: activeEngine,
        sessionId,
        partialXmlRef,
        getCurrentState: getCurrentStateForAgent,
        minimalStyle,
        getCanvasTheme: () => getExcalidrawScene?.()?.appState?.theme || "dark",
        onToolCall: async (toolCall, addToolOutputFn) => {
            console.log("[chat-panel] onToolCall received:", toolCall)
            await handleToolCall({ toolCall }, addToolOutputFn)
        },
        onExternalError: handleExternalError,
        onRetryLimitReached: handleRetryLimitReached,
        maxAutoRetry: MAX_AUTO_RETRY_COUNT,
        maxContinuationRetry: MAX_CONTINUATION_RETRY_COUNT,
    })

    // Update refs so error handler can access setMessages and messages
    useEffect(() => {
        agentSetMessagesRef.current = setMessages
    }, [setMessages])
    useEffect(() => {
        agentMessagesRef.current = messages
    }, [messages])

    // Ref to track latest messages for unload persistence
    const messagesRef = useRef(messages)
    useEffect(() => {
        messagesRef.current = messages
    }, [messages])

    // Track last synced session ID to detect external changes (e.g., URL back/forward)
    const lastSyncedSessionIdRef = useRef<string | null>(null)

    // Helper: Sync UI state with session data (eliminates duplication)
    // Track message IDs that are being loaded from session (to skip animations/scroll)
    const loadedMessageIdsRef = useRef<Set<string>>(new Set())
    // Track when session was just loaded (to skip auto-save on load)
    const justLoadedSessionRef = useRef(false)

    const syncUIWithSession = useCallback(
        (
            data: {
                messages: unknown[]
                diagramXml: string
                diagramHistory?: { svg: string; xml: string }[]
                excalidrawScene?: ExcalidrawScene
                excalidrawHistory?: ExcalidrawHistoryEntry[]
            } | null,
        ) => {
            debugLog('syncUIWithSession', {
                hasData: !!data,
                hasExcalidrawScene: !!data?.excalidrawScene,
                excalidrawElementsCount: data?.excalidrawScene?.elements?.length,
                excalidrawHistoryCount: data?.excalidrawHistory?.length,
                hasDiagramXml: !!data?.diagramXml,
                activeEngine,
                diagramEngineId
            })

            const hasRealDiagram = isRealDiagram(data?.diagramXml)
            if (data) {
                // Mark all message IDs as loaded from session
                const messageIds = (data.messages as any[]).map(
                    (m: any) => m.id,
                )
                loadedMessageIdsRef.current = new Set(messageIds)
                setMessages(data.messages as any)
                if (hasRealDiagram) {
                    onDisplayChart(data.diagramXml, true)
                    chartXMLRef.current = data.diagramXml
                } else {
                    clearDiagram()
                    // Clear refs to prevent stale data from being saved
                    chartXMLRef.current = ""
                    latestSvgRef.current = ""
                }
                setExcalidrawScene(data.excalidrawScene || EMPTY_EXCALIDRAW_SCENE)
                setDiagramHistory(data.diagramHistory || [])
                // 恢复 Excalidraw 历史记录
                initExcalidrawHistory(data.excalidrawHistory || [])
            } else {
                loadedMessageIdsRef.current = new Set()
                setMessages([])
                clearDiagram()
                // Clear refs to prevent stale data from being saved
                chartXMLRef.current = ""
                latestSvgRef.current = ""
                setDiagramHistory([])
                setExcalidrawScene(EMPTY_EXCALIDRAW_SCENE)
                // 清空 Excalidraw 历史记录
                initExcalidrawHistory([])
            }
        },
        [setMessages, onDisplayChart, clearDiagram, setDiagramHistory, setExcalidrawScene, initExcalidrawHistory],
    )

    // Helper: Build session data object for saving (eliminates duplication)
    const buildSessionData = useCallback(
        async (options: { withThumbnail?: boolean } = {}) => {
            // 始终使用 chartXMLRef.current 作为真实来源
            // 因为 loadDiagram 会同步更新 ref，而 state 是异步更新的
            // 当用户立即切换引擎时，ref 是最新值，state 可能还是旧值
            // 注意：即使 ref 是空字符串也要使用，因为这可能是用户清空后的状态
            const currentDiagramXml = chartXMLRef.current
            const currentExcalidraw = getExcalidrawScene()
            const currentExcalidrawHistory = getExcalidrawHistory()
            
            debugLog('buildSessionData', {
                activeEngine,
                hasExcalidraw: !!currentExcalidraw,
                excalidrawElementsCount: currentExcalidraw?.elements?.length,
                excalidrawHistoryLength: currentExcalidrawHistory?.length,
                excalidrawElements: currentExcalidraw?.elements?.map((e: any) => ({ id: e.id, type: e.type })),
                hasDiagramXml: !!currentDiagramXml,
                chartXMLState: !!chartXML,
                chartXMLRef: !!chartXMLRef.current
            })
            
            // Only capture thumbnail if there's a meaningful diagram (not just empty template)
            // For Drawio: check XML, for Excalidraw: check if scene has elements
            const hasRealDiagram = 
                activeEngine === "excalidraw"
                    ? (Array.isArray(currentExcalidraw?.elements) && currentExcalidraw.elements.length > 0)
                    : isRealDiagram(currentDiagramXml)
            let thumbnailDataUrl: string | undefined
            if (hasRealDiagram && options.withThumbnail) {
                const freshThumb = await getThumbnailSvg()
                if (freshThumb) {
                    latestSvgRef.current = freshThumb
                    thumbnailDataUrl = freshThumb
                } else if (latestSvgRef.current) {
                    // Use cached thumbnail only if we have a real diagram
                    thumbnailDataUrl = latestSvgRef.current
                }
            }
        return {
            messages: sanitizeMessages(messagesRef.current),
            diagramXml: currentDiagramXml,
            excalidrawScene: currentExcalidraw,
            thumbnailDataUrl,
            diagramHistory,
            excalidrawHistory: getExcalidrawHistory(),
        }
    },
        // chartXML 不再使用，但保留以触发重新计算时重新捕获 ref 值
        [diagramHistory, getThumbnailSvg, getExcalidrawScene, getExcalidrawHistory, activeEngine, chartXML],
    )

    // Restore messages and XML snapshots from session manager on mount
    // This effect syncs with the session manager's loaded session
    useLayoutEffect(() => {
        if (hasRestoredRef.current) return
        if (sessionManager.isLoading) return // Wait for session manager to load

        hasRestoredRef.current = true

        try {
            const currentSession = sessionManager.currentSession
            if (currentSession && currentSession.messages.length > 0) {
                // Restore from session manager (IndexedDB)
                justLoadedSessionRef.current = true
                syncUIWithSession(currentSession)
                setSessionId(currentSession.id)
            }
            // Initialize lastSyncedSessionIdRef to prevent sync effect from firing immediately
            lastSyncedSessionIdRef.current = sessionManager.currentSessionId
            // Note: Migration from old localStorage format is handled by session-storage.ts
        } catch (error) {
            console.error("Failed to restore session:", error)
            toast.error(dict.errors.sessionCorrupted)
        } finally {
            setIsRestored(true)
        }
    }, [
        sessionManager.isLoading,
        sessionManager.currentSession,
        syncUIWithSession,
        dict.errors.sessionCorrupted,
    ])

    // Sync UI when session changes externally (e.g., URL navigation via back/forward)
    // This handles changes AFTER initial restore
    useEffect(() => {
        if (!isRestored) return // Wait for initial restore to complete
        if (!sessionManager.isAvailable) return

        const newSessionId = sessionManager.currentSessionId
        const newSession = sessionManager.currentSession

        // Skip if session ID hasn't changed (our own saves don't change the ID)
        if (newSessionId === lastSyncedSessionIdRef.current) return

        // Update last synced ID
        lastSyncedSessionIdRef.current = newSessionId

        // Sync UI with new session
        if (newSession && newSession.messages.length > 0) {
            justLoadedSessionRef.current = true
            syncUIWithSession(newSession)
        } else if (!newSession) {
            syncUIWithSession(null)
        }
    }, [
        isRestored,
        sessionManager.isAvailable,
        sessionManager.currentSessionId,
        sessionManager.currentSession,
        syncUIWithSession,
    ])

    // Keep local sessionId in sync with session manager (e.g., after restore or switch)
    useEffect(() => {
        if (
            sessionManager.currentSessionId &&
            sessionManager.currentSessionId !== sessionId
        ) {
            setSessionId(sessionManager.currentSessionId)
        }
    }, [sessionManager.currentSessionId, sessionId])

    // Save messages to session manager (debounced, only when not streaming)
    // Destructure stable values to avoid effect re-running on every render
    const {
        isAvailable: sessionIsAvailable,
        currentSessionId,
        saveCurrentSession,
    } = sessionManager

    // Use ref for saveCurrentSession to avoid infinite loop
    // (saveCurrentSession changes after each save, which would re-trigger the effect)
    const saveCurrentSessionRef = useRef(saveCurrentSession)
    saveCurrentSessionRef.current = saveCurrentSession

    useEffect(() => {
        if (!hasRestoredRef.current) return
        if (!sessionIsAvailable) return
        // Only save when not actively streaming to avoid write storms
        if (status === "streaming" || status === "submitted") return
        
        // 引擎切换过程中不自动保存，防止空数据覆盖旧会话
        if (engineSwitchInProgressRef.current) return

        // Skip auto-save if session was just loaded (to prevent re-ordering)
        if (justLoadedSessionRef.current) {
            justLoadedSessionRef.current = false
            return
        }

        // Clear any pending save
        if (localStorageDebounceRef.current) {
            clearTimeout(localStorageDebounceRef.current)
        }

        // Capture current session ID at schedule time to verify at save time
        const scheduledForSessionId = currentSessionId
        // Capture whether there's a REAL diagram NOW (not just empty template)
        // For Drawio: check XML, for Excalidraw: check if scene has elements
        const currentExcalidrawScene = getExcalidrawScene()
        const hasDiagramNow = 
            activeEngine === "excalidraw"
                ? (Array.isArray(currentExcalidrawScene?.elements) && currentExcalidrawScene.elements.length > 0)
                : isRealDiagram(chartXMLRef.current)
        // Check if this session was just loaded without a diagram
        const isNodiagramSession =
            justLoadedSessionIdRef.current === scheduledForSessionId

        // Debounce: save after 1 second of no changes
        localStorageDebounceRef.current = setTimeout(async () => {
            // 再次检查引擎切换状态，防止 debounce 期间引擎已切换
            if (engineSwitchInProgressRef.current) {
                debugLog('auto-save skipped - engine switch in progress (inside timeout)')
                return
            }

            // 紧急修复：校验会话 ID 是否已变化
            // 防止引擎切换/会话切换期间，空数据覆盖原会话
            const currentSessionIdNow = sessionManager.currentSessionId
            if (scheduledForSessionId !== currentSessionIdNow) {
                debugLog('auto-save aborted - session changed during debounce', {
                    scheduled: scheduledForSessionId,
                    current: currentSessionIdNow,
                })
                return
            }

            // 紧急修复：不保存空消息且空画布，防止清空有内容的会话
            // 但如果有画布内容（如快照恢复），则允许保存
            if (messages.length === 0 && !hasDiagramNow) {
                debugLog('auto-save skipped - no messages and no diagram')
                return
            }

            try {
                const sessionData = await buildSessionData({
                    // Only capture thumbnail if there was a diagram AND this isn't a no-diagram session
                    withThumbnail: hasDiagramNow && !isNodiagramSession,
                })
                await saveCurrentSessionRef.current(
                    sessionData,
                    scheduledForSessionId,
                )
            } catch (error) {
                console.error("Failed to save session:", error)
            }
        }, LOCAL_STORAGE_DEBOUNCE_MS)

        // Cleanup on unmount
        return () => {
            if (localStorageDebounceRef.current) {
                clearTimeout(localStorageDebounceRef.current)
            }
        }
    }, [
        messages,
        status,
        sessionIsAvailable,
        currentSessionId,
        buildSessionData,
        activeEngine,  // 引擎变化时需要重新评估自动保存逻辑
        canvasVersion,  // 画布变化时触发 auto-save（如快照恢复）
        chartXML,  // DrawIO 画布变化时触发 auto-save
    ])

    // Update URL when a new session is created
    useEffect(() => {
        if (sessionManager.currentSessionId && !urlSessionId) {
            // A session was created but URL doesn't have the session param yet
            router.replace(`?session=${sessionManager.currentSessionId}`, {
                scroll: false,
            })
        }
    }, [sessionManager.currentSessionId, urlSessionId, router])

    // Save session ID to localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_SESSION_ID_KEY, sessionId)
    }, [sessionId])

    // Save session when page becomes hidden (tab switch, close, navigate away)
    // This is more reliable than beforeunload for async IndexedDB operations
    useEffect(() => {
        if (!sessionManager.isAvailable) return

        const handleVisibilityChange = async () => {
            if (
                document.visibilityState === "hidden" &&
                messagesRef.current.length > 0
            ) {
                try {
                    // Attempt to save session - browser may not wait for completion
                    // Skip thumbnail capture as it may not complete in time
                    const sessionData = await buildSessionData({
                        withThumbnail: false,
                    })
                    await sessionManager.saveCurrentSession(sessionData)
                } catch (error) {
                    console.error(
                        "Failed to save session on visibility change:",
                        error,
                    )
                }
            }
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)
        return () =>
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            )
    }, [sessionManager, buildSessionData])

    const onFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const isProcessing = status === "streaming" || status === "submitted"
        debugLog("submit", { inputLength: input.length, isProcessing, files })
        if (input.trim() && !isProcessing) {
            const trimmedInput = input.trim()
            // Check if input matches a cached example (only when no messages yet)
            if (messages.length === 0) {
                const cached = findCachedResponse(
                    trimmedInput,
                    files.length > 0,
                )
                if (cached) {
                    // Add user message and fake assistant response to messages
                    // The chat-message-display useEffect will handle displaying the diagram
                    const toolCallId = `cached-${Date.now()}`

                    // Build user message text including any file content
                    const userText = await processFilesAndAppendContent(
                        input,
                        files,
                        pdfData,
                        undefined,
                        urlData,
                    )

                    setMessages([
                        {
                            id: `user-${Date.now()}`,
                            role: "user" as const,
                            parts: [{ type: "text" as const, text: userText }],
                        },
                        {
                            id: `assistant-${Date.now()}`,
                            role: "assistant" as const,
                            parts: [
                                {
                                    type: "tool-display_drawio" as const,
                                    toolCallId,
                                    state: "output-available" as const,
                                    input: { xml: cached.xml },
                                    output: "Successfully displayed the diagram.",
                                },
                            ],
                        },
                    ] as any)
                    setInput("")
                    // Save to history
                    setInputHistory((prev) => {
                        const next =
                            prev[prev.length - 1] === trimmedInput
                                ? prev
                                : [...prev.slice(-49), trimmedInput]
                        sessionStorage.setItem(
                            HISTORY_STORAGE_KEY,
                            JSON.stringify(next),
                        )
                        return next
                    })
                    setHistoryIndex(null)
                    sessionStorage.removeItem(SESSION_STORAGE_INPUT_KEY)
                    setFiles([])
                    setUrlData(new Map())
                    return
                }
            }

            try {
                // 历史版本保存已移至工具调用成功后（use-diagram-tool-handlers.ts）
                // 这样可以确保只有工具成功修改画布后才保存历史

                let chartXml: string | undefined
                try {
                    // 不保存历史，历史保存由工具 handler 在成功后处理
                    chartXml = await onFetchChart(false)
                } catch (err) {
                    console.error("Error fetching chart data:", err)
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : "导出画布失败，请稍后重试",
                    )
                    return
                }
                chartXml = formatXML(chartXml || "")

                // Update ref directly to avoid race condition with React's async state update
                // This ensures edit_drawio has the correct XML before AI responds
                chartXMLRef.current = chartXml

                // Build user text by concatenating input with pre-extracted text
                // (Backend only reads first text part, so we must combine them)
                const parts: any[] = []
                const userText = await processFilesAndAppendContent(
                    input,
                    files,
                    pdfData,
                    parts,
                    urlData,
                )

                // Add the combined text as the first part
                parts.unshift({ type: "text", text: userText })

                sendChatMessage(
                    parts,
                    chartXml,
                    "",  // previousXml no longer needed
                    sessionId,
                    activeEngine,
                )

                // Token count is tracked in onFinish with actual server usage
                setInput("")
                setInputHistory((prev) => {
                    const next =
                        prev[prev.length - 1] === trimmedInput
                            ? prev
                            : [...prev.slice(-49), trimmedInput]
                    sessionStorage.setItem(
                        HISTORY_STORAGE_KEY,
                        JSON.stringify(next),
                    )
                    return next
                })
                setHistoryIndex(null)
                sessionStorage.removeItem(SESSION_STORAGE_INPUT_KEY)
                setFiles([])
                setUrlData(new Map())
            } catch (error) {
                console.error("Error fetching chart data:", error)
            }
        }
    }

    // 会话切换核心逻辑（提取为独立函数，便于复用）
    const doSelectSession = useCallback(
        async (sessionId: string) => {
            // 保存当前会话
            if (messages.length > 0) {
                const sessionData = await buildSessionData({ withThumbnail: true })
                await sessionManager.saveCurrentSession(sessionData)
            }

            // 切换会话
            const sessionData = await sessionManager.switchSession(sessionId)
            debugLog('[doSelectSession] Session data loaded from IndexedDB:', {
                sessionId,
                diagramXmlLength: sessionData?.diagramXml?.length,
                diagramXmlPreview: sessionData?.diagramXml?.substring(0, 100),
            })
            if (sessionData) {
                debugLog("switchSession loaded", {
                    msgCount: sessionData.messages.length,
                    hasXml: !!sessionData.diagramXml,
                    hasExcalidraw: !!sessionData.excalidrawScene,
                    historyLen: sessionData.diagramHistory?.length,
                })
                const hasRealDiagram = isRealDiagram(sessionData.diagramXml)
                justLoadedSessionRef.current = true
                latestSvgRef.current = sessionData.thumbnailDataUrl || ""

                if (!hasRealDiagram) {
                    justLoadedSessionIdRef.current = sessionId
                } else {
                    justLoadedSessionIdRef.current = null
                }
                
                setSessionId(sessionId)
                syncUIWithSession(sessionData)
                router.replace(`?session=${sessionId}`, { scroll: false })
            }
            
            // 解锁引擎切换锁
            engineSwitchInProgressRef.current = false
        },
        [sessionManager, messages, buildSessionData, syncUIWithSession, router],
    )

    // Handle session switching from history dropdown
    const handleSelectSession = useCallback(
        async (sessionId: string) => {
            if (!sessionManager.isAvailable) return
            
            // 防止引擎切换过程中选择会话
            if (engineSwitchInProgressRef.current) {
                debugLog("selectSession blocked - engine switch in progress, queuing:", sessionId)
                pendingSessionToOpenRef.current = sessionId
                return
            }
            
            debugLog("selectSession", { sessionId })

            // 识别目标会话的引擎类型
            const target = sessionManager.sessions.find((s) => s.id === sessionId)
            const targetEngine = target?.engineId

            // 引擎不匹配时，先切换引擎再打开会话
            if (targetEngine && targetEngine !== activeEngine) {
                engineSwitchInProgressRef.current = true

                try {
                    // 1. 保存当前会话
                    if (messages.length > 0) {
                        const sessionData = await buildSessionData({ withThumbnail: true })
                        await sessionManager.saveCurrentSession(sessionData)
                    }

                    // 2. 关键修复：重置 DrawIO 就绪状态
                    // 确保切换到 DrawIO 会话时，useEffect([isDrawioReady]) 能正确触发恢复逻辑
                    resetDrawioReady()

                    // 3. 切换引擎（不新建会话，因为要加载目标会话）
                    pendingSessionToOpenRef.current = sessionId
                    setDiagramEngineId(targetEngine)
                    setStartNewChatAfterEngineSwitch(false)  // 关键：不要新建会话
                    // 注意：engineSwitchInProgressRef 会在 doSelectSession 中解锁
                } catch (error) {
                    console.error('[handleSelectSession] Error during engine switch:', error)
                    engineSwitchInProgressRef.current = false
                }
                return
            }

            // 同引擎切换会话
            await doSelectSession(sessionId)
        },
        [sessionManager, messages, buildSessionData, activeEngine, doSelectSession],
    )
    
    // 引擎切换后打开待处理的会话
    useEffect(() => {
        const pending = pendingSessionToOpenRef.current
        if (!pending) return
        if (!sessionManager.isAvailable) return
        
        // 确保引擎已切换完成
        const target = sessionManager.sessions.find((s) => s.id === pending)
        if (target?.engineId && target.engineId !== activeEngine) {
            // 引擎还没切换完成，等待
            return
        }
        
        debugLog("pendingSession effect - opening:", pending)
        pendingSessionToOpenRef.current = null
        doSelectSession(pending)
    }, [activeEngine, sessionManager.isAvailable, sessionManager.sessions, doSelectSession])

    // Handle session deletion from history dropdown
    const handleDeleteSession = useCallback(
        async (sessionId: string) => {
            if (!sessionManager.isAvailable) return
            const result = await sessionManager.deleteSession(sessionId)
            debugLog("deleteSession", { sessionId, wasCurrent: result.wasCurrentSession })

            if (result.wasCurrentSession) {
                // Deleted current session - clear UI and URL
                syncUIWithSession(null)
                router.replace(window.location.pathname, { scroll: false })
            }
        },
        [sessionManager, syncUIWithSession, router],
    )

    const handleNewChat = useCallback(async () => {
        // Save current session before creating new one
        if (sessionManager.isAvailable && messages.length > 0) {
            const sessionData = await buildSessionData({ withThumbnail: true })
            await sessionManager.saveCurrentSession(sessionData)
            // Refresh sessions list to ensure dropdown shows the saved session
            await sessionManager.refreshSessions()
        }

        // Clear session manager state BEFORE clearing URL to prevent race condition
        // (otherwise the URL update effect would restore the old session URL)
        sessionManager.clearCurrentSession()
        // 防止 URL 同步 effect 干扰（与引擎切换时的处理保持一致）
        sessionManager.skipNextUrlSync()
        lastSyncedSessionIdRef.current = null
        debugLog("newChat cleared session")

        // Clear UI state (can't use syncUIWithSession here because we also need to clear files)
        setMessages([])
        clearDiagram()
        setDiagramHistory([])
        initExcalidrawHistory([]) // 清空 Excalidraw 历史记录
        handleFileChange([]) // Use handleFileChange to also clear pdfData
        setUrlData(new Map())
        const newSessionId = `session-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 9)}`
        setSessionId(newSessionId)
        sessionStorage.removeItem(SESSION_STORAGE_INPUT_KEY)
        // toast.success(dict.dialogs.clearSuccess)
        debugLog("newChat created", newSessionId)

        // Clear URL param to show blank state
        router.replace(window.location.pathname, { scroll: false })
    }, [
        clearDiagram,
        handleFileChange,
        setMessages,
        setSessionId,
        sessionManager,
        messages,
        router,
        dict.dialogs.clearSuccess,
        buildSessionData,
        setDiagramHistory,
        initExcalidrawHistory,
    ])

    const handleLanguageChange = useCallback((lang: string) => {
        // Save locale to localStorage for persistence across restarts
        localStorage.setItem("agnx-locale", lang)
        setCurrentLang(lang as Locale)

        const parts = pathname.split("/")
        if (parts.length > 1 && i18n.locales.includes(parts[1] as Locale)) {
            parts[1] = lang
        } else {
            parts.splice(1, 0, lang)
        }
        const newPath = parts.join("/") || "/"
        const searchStr = searchParams?.toString() ? `?${searchParams.toString()}` : ""
        router.push(newPath + searchStr)
    }, [pathname, searchParams, router])

    const handleLanguageToggle = useCallback(() => {
        // Toggle between available languages
        const currentIndex = i18n.locales.indexOf(currentLang)
        const nextIndex = (currentIndex + 1) % i18n.locales.length
        const nextLang = i18n.locales[nextIndex]
        handleLanguageChange(nextLang)
    }, [currentLang, handleLanguageChange])

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
        saveInputToSessionStorage(e.target.value)
        setInput(e.target.value)
    }

    const saveInputToSessionStorage = (input: string) => {
        sessionStorage.setItem(SESSION_STORAGE_INPUT_KEY, input)
    }

    const handleHistoryPrev = useCallback((): string | null => {
        if (inputHistory.length === 0) return null
        const nextIndex =
            historyIndex === null
                ? inputHistory.length - 1
                : Math.max(historyIndex - 1, 0)
        setHistoryIndex(nextIndex)
        return inputHistory[nextIndex] ?? null
    }, [historyIndex, inputHistory])

    const handleHistoryNext = useCallback((): string | null => {
        if (inputHistory.length === 0) return null
        if (historyIndex === null) return ""
        if (historyIndex >= inputHistory.length - 1) {
            setHistoryIndex(null)
            return ""
        }
        const nextIndex = historyIndex + 1
        setHistoryIndex(nextIndex)
        return inputHistory[nextIndex] ?? ""
    }, [historyIndex, inputHistory])

    // 引擎切换后的新建会话逻辑（仅在 startNewChatAfterEngineSwitch 为 true 时触发）
    useEffect(() => {
        if (!startNewChatAfterEngineSwitch) return
        
        const handleEngineSwitchNewChat = async () => {
            try {
                // 清除会话管理器状态
                sessionManager.clearCurrentSession()
                // 防止 URL 同步 effect 干扰（双重保险，配合按钮点击时的 skipNextUrlSync）
                sessionManager.skipNextUrlSync()
                lastSyncedSessionIdRef.current = null
                debugLog("newChat cleared session (after engine switch)")

                // 清除 UI 状态
                setMessages([])
                clearDiagram()
                setDiagramHistory([])
                initExcalidrawHistory([]) // 清空 Excalidraw 历史记录
                handleFileChange([])
                setUrlData(new Map())
                // 根据当前 dark mode 状态设置 Excalidraw 主题
                const currentTheme = document.documentElement.classList.contains("dark") ? "dark" : "light"
                setExcalidrawScene({
                    ...EMPTY_EXCALIDRAW_SCENE,
                    appState: {
                        ...EMPTY_EXCALIDRAW_SCENE.appState,
                        theme: currentTheme,
                    },
                })

                const newSessionId = `session-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2, 9)}`
                setSessionId(newSessionId)
                sessionStorage.removeItem(SESSION_STORAGE_INPUT_KEY)

                // 清除 URL
                router.replace(window.location.pathname, { scroll: false })
                
                // toast.success(dict.dialogs.clearSuccess)
                debugLog("newChat created (after engine switch)", newSessionId)
            } finally {
                engineSwitchInProgressRef.current = false
            }
        }
        
        handleEngineSwitchNewChat()
        setStartNewChatAfterEngineSwitch(false)
    }, [startNewChatAfterEngineSwitch, sessionManager, clearDiagram, handleFileChange, setMessages, setSessionId, router, dict.dialogs.clearSuccess, setDiagramHistory, setExcalidrawScene, initExcalidrawHistory])

    // Send chat message wrapper - delegates to useAgent's sendMessage
    const sendChatMessage = useCallback((
        parts: any,
        xml: string,
        previousXml: string,
        _sessionId: string,
        _engineId?: string,
    ) => {
        // Reset partialXmlRef on user-initiated message
        partialXmlRef.current = ""

        agentSendMessage('', {
            parts,
            currentState: xml,
            previousState: previousXml,
        })
    }, [agentSendMessage])

    // Process files and append content to user text (handles PDF, text, and optionally images)
    const processFilesAndAppendContent = async (
        baseText: string,
        files: File[],
        pdfData: Map<File, FileData>,
        imageParts?: any[],
        urlDataParam?: Map<string, UrlData>,
    ): Promise<string> => {
        let userText = baseText

        for (const file of files) {
            if (isPdfFile(file)) {
                const extracted = pdfData.get(file)
                if (extracted?.text) {
                    userText += `\n\n[PDF: ${file.name}]\n${extracted.text}`
                }
            } else if (isTextFile(file)) {
                const extracted = pdfData.get(file)
                if (extracted?.text) {
                    userText += `\n\n[File: ${file.name}]\n${extracted.text}`
                }
            } else if (imageParts) {
                // Handle as image (only if imageParts array provided)
                const reader = new FileReader()
                const dataUrl = await new Promise<string>((resolve) => {
                    reader.onload = () => resolve(reader.result as string)
                    reader.readAsDataURL(file)
                })

                imageParts.push({
                    type: "file",
                    url: dataUrl,
                    mediaType: file.type,
                })
            }
        }

        if (urlDataParam) {
            for (const [url, data] of urlDataParam) {
                if (data.content) {
                    userText += `\n\n[URL: ${url}]\nTitle: ${data.title}\n\n${data.content}`
                }
            }
        }

        return userText
    }

    // Message action handlers - delegate to useAgent methods
    const handleRegenerate = useCallback(async (messageIndex: number) => {
        await agentRegenerate(messageIndex)
    }, [agentRegenerate])

    const handleEditMessage = useCallback(async (messageIndex: number, newText: string) => {
        await agentEditMessage(messageIndex, newText)
        // Focus the input after editing
        setTimeout(() => {
            chatInputRef.current?.focus()
        }, 0)
    }, [agentEditMessage])

    // Handle deleting a message (and optionally its paired message)
    const handleDeleteMessage = useCallback((messageIndex: number) => {
        agentDeleteMessage(messageIndex)
    }, [agentDeleteMessage])

    // Collapsed view (desktop only)
    if (!isVisible && !isMobile) {
        return (
            <div className="h-full flex flex-col items-center pt-4 bg-card border border-border/30 rounded-xl">
                <ButtonWithTooltip
                    tooltipContent={dict.nav.showPanel}
                    variant="ghost"
                    size="icon"
                    onClick={onToggleVisibility}
                    className="hover:bg-accent transition-colors"
                >
                    <PanelRightOpen className="h-5 w-5 text-muted-foreground" />
                </ButtonWithTooltip>
                <div
                    className="text-sm font-medium text-muted-foreground mt-8 tracking-wide"
                    style={{
                        writingMode: "vertical-rl",
                    }}
                >
                    {dict.nav.aiChat}
                </div>
            </div>
        )
    }

    // Full view
    return (
        <div
            id="chat-panel-container"
            className={cn(
                "h-full bg-card shadow-soft rounded-xl border border-border/30 relative overflow-hidden",
                shouldAnimatePanel && "animate-slide-in-right",
            )}
        >
            <Toaster
                position="bottom-left"
                richColors
                expand
                toastOptions={{
                    style: {
                        maxWidth: "480px",
                    },
                    duration: 2000,
                }}
            />
            {/* Header - 浮动在顶部 */}
            <header
                className={cn(
                    "absolute top-0 left-0 right-0 z-20 flex justify-center",
                    "bg-card/80 backdrop-blur-xs",
                    isMobile ? "px-3 py-2" : "px-5 py-4"
                )}
            >
                <div className="input-glow-wrapper">
                <div 
                    className={cn(
                        "group relative inline-flex items-center rounded-2xl border border-border/30 bg-muted shadow-sm backdrop-blur-sm overflow-hidden transition-all duration-300 input-glow-inner"
                    )}
                    style={{ minHeight: '48px' }}
                >
                    {/* Shimmer overlay - only visible when streaming */}
                    {(status === "streaming" || status === "submitted") && (
                        <div 
                            className="absolute inset-0 shimmer-overlay pointer-events-none"
                            style={{
                                background: 'linear-gradient(90deg, transparent 0%, rgba(239, 68, 68, 0.2) 50%, transparent 100%)',
                                backgroundSize: '200% 100%',
                            }}
                        />
                    )}

                    {/* Title and Version Badge - Default state */}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 px-6 group-hover:opacity-0 group-hover:scale-95 transition-all duration-300 pointer-events-none group-hover:pointer-events-none">
                        <h1 className="text-base font-semibold tracking-tight whitespace-nowrap">
                            AI-Drawer
                        </h1>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium whitespace-nowrap border border-primary/30">
                            v{process.env.APP_VERSION || '0.1.0'}
                        </span>
                        {modelConfig.selectedModel && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium whitespace-nowrap border border-primary/30 truncate max-w-32">
                                {modelConfig.selectedModel.modelId}
                            </span>
                        )}
                    </div>

                    {/* Action Buttons - Hover state */}
                    <div className="flex items-center gap-0 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300">
                        <HeaderActionButton
                            onClick={handleLanguageToggle}
                            tooltip={`${dict.settings.language}: ${LANGUAGE_LABELS[currentLang]}`}
                        >
                            <Languages className="h-5 w-5 text-foreground" />
                        </HeaderActionButton>

                        <HeaderActionButton
                            onClick={onToggleDarkMode}
                            tooltip={dict.settings.theme}
                        >
                            {darkMode ? (
                                <Sun className="h-5 w-5 text-foreground" />
                            ) : (
                                <Moon className="h-5 w-5 text-foreground" />
                            )}
                        </HeaderActionButton>

                        <HeaderActionButton
                            onClick={() => setMinimalStyle(!minimalStyle)}
                            tooltip={minimalStyle ? dict.chat.minimalTooltip : dict.chat.styledMode}
                        >
                            {minimalStyle ? (
                                <Zap className="h-5 w-5 text-foreground" />
                            ) : (
                                <Sparkles className="h-5 w-5 text-foreground" />
                            )}
                        </HeaderActionButton>

                        <HeaderActionButton
                            onClick={onToggleDrawioUi}
                            tooltip={`${dict.settings.drawioStyle}: ${drawioUi === "min" ? dict.settings.minimal : dict.settings.sketch}`}
                        >
                            <Palette className="h-5 w-5 text-foreground" />
                        </HeaderActionButton>

                        <HeaderActionButton
                            onClick={handleNewChat}
                            disabled={status === "streaming" || status === "submitted"}
                            tooltip={dict.nav.newChat}
                        >
                            <MessageSquarePlus className="h-5 w-5 text-foreground" />
                        </HeaderActionButton>

                        <HeaderActionButton
                            onClick={() => window.open('https://github.com/duo121/agnx-drawer', '_blank')}
                            tooltip="GitHub"
                        >
                            <Github className="h-5 w-5 text-foreground" />
                        </HeaderActionButton>

                        {!isMobile && (
                            <HeaderActionButton
                                onClick={onToggleVisibility}
                                tooltip={dict.nav.hidePanel}
                            >
                                <PanelRightClose className="h-5 w-5 text-foreground" />
                            </HeaderActionButton>
                        )}
                    </div>
                </div>
                </div>
            </header>

            <style jsx>{`
                @keyframes shimmer-slide {
                    0% {
                        background-position: -100% 0;
                    }
                    50% {
                        background-position: 100% 0;
                    }
                    100% {
                        background-position: -100% 0;
                    }
                }
                .shimmer-overlay {
                    animation: shimmer-slide 6s linear infinite;
                }
            `}</style>

            {/* Messages - 全屏滚动区域，留出 header 和 footer 空间 */}
            <main 
                className="absolute inset-0 overflow-y-auto"
                style={{ 
                    paddingTop: isMobile ? '56px' : '72px',
                    paddingBottom: isMobile ? '80px' : '96px'
                }}
            >
                <ChatMessageDisplay
                    messages={messages}
                    setInput={setInput}
                    setFiles={handleFileChange}
                    processedToolCallsRef={processedToolCallsRef}
                    editDiagramOriginalXmlRef={editDiagramOriginalXmlRef}
                    sessionId={sessionId}
                    onRegenerate={handleRegenerate}
                    status={status}
                    onEditMessage={handleEditMessage}
                    onDeleteMessage={handleDeleteMessage}
                    onFocusInput={() => chatInputRef.current?.focus()}
                    isRestored={isRestored}
                    sessions={sessionManager.sessions}
                    onSelectSession={handleSelectSession}
                    onDeleteSession={handleDeleteSession}
                    loadedMessageIdsRef={loadedMessageIdsRef}
                    currentEngine={activeEngine}
                    onStop={() => {
                        stop()
                        // 清理截断续传状态
                        partialXmlRef.current = ""
                    }}
                />
            </main>

            {/* Input - 浮动在底部 */}
            <footer
                className={cn(
                    "absolute bottom-0 left-0 right-0 z-20",
                    "bg-card/80 backdrop-blur-xs",
                    isMobile ? "p-2" : "p-4"
                )}
            >
                <ChatInput
                    ref={chatInputRef}
                    input={input}
                    status={status}
                    onSubmit={onFormSubmit}
                    onChange={handleInputChange}
                    onHistoryPrev={handleHistoryPrev}
                    onHistoryNext={handleHistoryNext}
                    engineId={activeEngine}
                    files={files}
                    onFileChange={handleFileChange}
                    pdfData={pdfData}
                    urlData={urlData}
                    onUrlChange={setUrlData}
                    sessionId={sessionId}
                    error={error}
                    models={modelConfig.models}
                    selectedModelId={modelConfig.selectedModelId}
                    onModelSelect={modelConfig.setSelectedModelId}
                    showUnvalidatedModels={modelConfig.showUnvalidatedModels}
                    modelConfig={modelConfig}
                    minimalStyle={minimalStyle}
                    onMinimalStyleChange={setMinimalStyle}
                    activeEngine={activeEngine}
                    isEngineSwitching={engineSwitchInProgressRef.current}
                    isDialogOpen={(() => {
                        console.log('[Panel] showModelConfigDialog:', showModelConfigDialog)
                        return showModelConfigDialog
                    })()}
                    // 历史会话
                    sessions={sessionManager.sessions}
                    currentSessionId={sessionManager.currentSessionId}
                    onSessionSwitch={handleSelectSession}
                    onSessionDelete={handleDeleteSession}
                    onSessionCreate={handleNewChat}
                    onSessionRename={sessionManager.renameSession}
                    onEngineSwitch={async () => {
                        // 防止重复点击或在引擎切换过程中再次点击
                        if (engineSwitchInProgressRef.current) return
                        engineSwitchInProgressRef.current = true
                        
                        try {
                            // 保存当前会话
                            if (sessionManager.isAvailable && messages.length > 0) {
                                const sessionData = await buildSessionData({ withThumbnail: true })
                                debugLog('[Engine switch] Saving session before switch:', {
                                    sessionId: sessionManager.currentSessionId,
                                    diagramXmlLength: sessionData.diagramXml?.length,
                                })
                                await sessionManager.saveCurrentSession(sessionData)
                            }

                            const nextEngine = activeEngine === "drawio" ? "excalidraw" : "drawio"

                            // 防止 URL 同步 effect 加载旧会话
                            sessionManager.skipNextUrlSync()

                            // 重置 DrawIO 就绪状态
                            resetDrawioReady()

                            // 切换引擎并标记需要新建会话
                            setDiagramEngineId(nextEngine)
                            setStartNewChatAfterEngineSwitch(true)
                        } catch (error) {
                            console.error('[Engine switch] Error:', error)
                            engineSwitchInProgressRef.current = false
                        }
                    }}
                    onStop={() => {
                        stop()
                        // 清理截断续传状态
                        partialXmlRef.current = ""
                    }}
                />
            </footer>

            <ModelConfigDialog
                open={showModelConfigDialog}
                onOpenChange={setShowModelConfigDialog}
                modelConfig={modelConfig}
            />
        </div>
    )
}
