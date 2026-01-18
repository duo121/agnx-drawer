"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
    type ChatSession,
    createEmptySession,
    deleteSession as deleteSessionFromDB,
    enforceSessionLimit,
    extractTitle,
    getAllSessionMetadata,
    getSession,
    isIndexedDBAvailable,
    migrateFromLocalStorage,
    type SessionMetadata,
    type StoredMessage,
    saveSession,
} from "./storage"

export interface SessionData {
    messages: StoredMessage[]
    /** DrawIO 图表 XML */
    drawioXml: string
    /** DrawIO 历史版本 */
    drawioHistory?: { svg: string; xml: string; timestamp?: number; isManual?: boolean }[]
    /** Excalidraw 场景 */
    excalidrawScene?: any
    /** Excalidraw 历史版本 */
    excalidrawHistory?: any[]
    thumbnailDataUrl?: string
}

export interface UseSessionManagerReturn {
    // State
    sessions: SessionMetadata[]
    currentSessionId: string | null
    currentSession: ChatSession | null
    isLoading: boolean
    isAvailable: boolean

    // Actions
    switchSession: (id: string) => Promise<SessionData | null>
    deleteSession: (id: string) => Promise<{ wasCurrentSession: boolean }>
    renameSession: (id: string, newTitle: string) => Promise<void>
    // forSessionId: optional session ID to verify save targets correct session (prevents stale debounce writes)
    saveCurrentSession: (
        data: SessionData,
        forSessionId?: string | null,
    ) => Promise<void>
    refreshSessions: () => Promise<void>
    clearCurrentSession: () => void
    // 跳过下一次 URL 同步（用于引擎切换时防止竞态）
    skipNextUrlSync: () => void
}

interface UseSessionManagerOptions {
    /** Session ID from URL param - if provided, load this session; if null, start blank */
    initialSessionId?: string | null
    /** 当前激活的引擎，用于新建会话时设置 activeEngineId */
    activeEngineId?: string
}

export function useSessionManager(
    options: UseSessionManagerOptions = {},
): UseSessionManagerReturn {
    const { initialSessionId, activeEngineId } = options
    const [sessions, setSessions] = useState<SessionMetadata[]>([])
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(
        null,
    )
    const [currentSession, setCurrentSession] = useState<ChatSession | null>(
        null,
    )
    const [isLoading, setIsLoading] = useState(true)
    const [isAvailable, setIsAvailable] = useState(false)

    const isInitializedRef = useRef(false)
    // Sequence guard for URL changes - prevents out-of-order async resolution
    const urlChangeSequenceRef = useRef(0)
    const allSessionsRef = useRef<SessionMetadata[]>([])
    // 外部控制标志：跳过下一次 URL 同步（用于引擎切换等场景）
    const skipNextUrlSyncRef = useRef(false)

    // Load sessions list
    const refreshSessions = useCallback(async () => {
        if (!isIndexedDBAvailable()) return
        try {
            const metadata = await getAllSessionMetadata()
            allSessionsRef.current = metadata
            setSessions(metadata)
        } catch (error) {
            console.error("Failed to refresh sessions:", error)
        }
    }, [])

    // Initialize on mount
    useEffect(() => {
        if (isInitializedRef.current) return
        isInitializedRef.current = true

        async function init() {
            setIsLoading(true)

            if (!isIndexedDBAvailable()) {
                setIsAvailable(false)
                setIsLoading(false)
                return
            }

            setIsAvailable(true)

            try {
                // Run migration first (one-time conversion from localStorage)
                await migrateFromLocalStorage()

                // Load sessions list
                const metadata = await getAllSessionMetadata()
                allSessionsRef.current = metadata
                setSessions(metadata)

                // Only load a session if initialSessionId is provided (from URL param)
                if (initialSessionId) {
                    const session = await getSession(initialSessionId)
                    if (session) {
                        setCurrentSession(session)
                        setCurrentSessionId(session.id)
                    }
                    // If session not found, stay in blank state (URL has invalid session ID)
                }
                // If no initialSessionId, start with blank state (no auto-restore)
            } catch (error) {
                console.error("Failed to initialize session manager:", error)
            } finally {
                setIsLoading(false)
            }
        }

        init()
    }, [initialSessionId])

    // Handle URL session ID changes after initialization
    // Note: intentionally NOT including currentSessionId in deps to avoid race conditions
    // when clearCurrentSession() is called before URL updates
    useEffect(() => {
        if (!isInitializedRef.current) return // Wait for initial load
        if (!isAvailable) return
        
        // 检查是否应该跳过此次同步（用于引擎切换等场景防止竞态）
        if (skipNextUrlSyncRef.current) {
            skipNextUrlSyncRef.current = false
            return
        }

        // Increment sequence to invalidate any pending async operations
        urlChangeSequenceRef.current++
        const currentSequence = urlChangeSequenceRef.current

        async function handleSessionIdChange() {
            if (initialSessionId) {
                // URL has session ID - load it
                const session = await getSession(initialSessionId)

                // Check if this request is still the latest (sequence guard)
                // If not, a newer URL change happened while we were loading
                if (currentSequence !== urlChangeSequenceRef.current) {
                    return
                }

                if (session) {
                    // Only update if the session is different from current
                    setCurrentSessionId((current) => {
                        if (current !== session.id) {
                            setCurrentSession(session)
                            return session.id
                        }
                        return current
                    })
                }
            }
            // Removed: else clause that clears session
            // Clearing is now handled explicitly by clearCurrentSession()
            // This prevents race conditions when URL update is async
        }

        handleSessionIdChange()
    }, [initialSessionId, isAvailable])

    // Refresh sessions on window focus (multi-tab sync)
    useEffect(() => {
        const handleFocus = () => {
            refreshSessions()
        }
        window.addEventListener("focus", handleFocus)
        return () => window.removeEventListener("focus", handleFocus)
    }, [refreshSessions])

    // Switch to a different session
    const switchSession = useCallback(
        async (id: string): Promise<SessionData | null> => {
            if (id === currentSessionId) return null

            // Save current session first if it has messages
            if (currentSession && currentSession.messages.length > 0) {
                await saveSession(currentSession)
            }

            // Load the target session
            const session = await getSession(id)
            if (!session) {
                console.error("Session not found:", id)
                return null
            }

            // Update state
            setCurrentSession(session)
            setCurrentSessionId(session.id)

            return {
                messages: session.messages,
                drawioXml: session.drawioXml,
                drawioHistory: session.drawioHistory,
                excalidrawScene: session.excalidrawScene,
                excalidrawHistory: session.excalidrawHistory,
                thumbnailDataUrl: session.thumbnailDataUrl,
            }
        },
        [currentSessionId, currentSession],
    )

    // Delete a session
    const deleteSession = useCallback(
        async (id: string): Promise<{ wasCurrentSession: boolean }> => {
            const wasCurrentSession = id === currentSessionId
            await deleteSessionFromDB(id)

            // If deleting current session, clear state (caller will show new empty session)
            if (wasCurrentSession) {
                setCurrentSession(null)
                setCurrentSessionId(null)
            }

            await refreshSessions()

            return { wasCurrentSession }
        },
        [currentSessionId, refreshSessions],
    )

    // Save current session data (debounced externally by caller)
    // forSessionId: if provided, verify save targets correct session (prevents stale debounce writes)
    const saveCurrentSession = useCallback(
        async (
            data: SessionData,
            forSessionId?: string | null,
        ): Promise<void> => {
            // 调试日志：追踪保存操作
            console.log('[saveCurrentSession] Called:', {
                forSessionId,
                currentSessionId,
                currentSessionActiveEngineId: currentSession?.activeEngineId,
                dataMessagesCount: data.messages?.length,
                dataDrawioXmlLength: data.drawioXml?.length,
                dataExcalidrawElementsCount: data.excalidrawScene?.elements?.length,
                hasCurrentSession: !!currentSession,
            })

            // If forSessionId is provided, verify it matches current session
            // This prevents stale debounced saves from overwriting a newly switched session
            if (
                forSessionId !== undefined &&
                forSessionId !== currentSessionId
            ) {
                console.log('[saveCurrentSession] Skipped - session ID mismatch:', {
                    forSessionId,
                    currentSessionId,
                })
                return
            }

            if (!currentSession) {
                // Create a new session if none exists
                const newSession: ChatSession = {
                    ...createEmptySession(activeEngineId),
                    messages: data.messages,
                    drawioXml: data.drawioXml,
                    drawioHistory: data.drawioHistory,
                    excalidrawScene: data.excalidrawScene,
                    excalidrawHistory: data.excalidrawHistory,
                    thumbnailDataUrl: data.thumbnailDataUrl,
                    title: extractTitle(data.messages),
                }
                await saveSession(newSession)
                await enforceSessionLimit()
                setCurrentSession(newSession)
                setCurrentSessionId(newSession.id)
                await refreshSessions()
                return
            }

            // Update existing session
            // activeEngineId 使用当前激活引擎（可能已切换）
            const updatedSession: ChatSession = {
                ...currentSession,
                messages: data.messages,
                drawioXml: data.drawioXml,
                drawioHistory: data.drawioHistory ?? currentSession.drawioHistory,
                excalidrawScene: data.excalidrawScene ?? currentSession.excalidrawScene,
                excalidrawHistory: data.excalidrawHistory ?? currentSession.excalidrawHistory,
                thumbnailDataUrl:
                    data.thumbnailDataUrl ?? currentSession.thumbnailDataUrl,
                updatedAt: Date.now(),
                // activeEngineId 更新为当前激活引擎
                activeEngineId: activeEngineId || currentSession.activeEngineId,
                // Update title if it's still default and we have messages
                title:
                    currentSession.title === "New Chat" &&
                    data.messages.length > 0
                        ? extractTitle(data.messages)
                        : currentSession.title,
            }

            console.log('[saveCurrentSession] Saving updated session:', {
                sessionId: updatedSession.id,
                activeEngineId: updatedSession.activeEngineId,
                messagesCount: updatedSession.messages.length,
                drawioXmlLength: updatedSession.drawioXml?.length,
                excalidrawElementsCount: updatedSession.excalidrawScene?.elements?.length,
            })

            await saveSession(updatedSession)
            setCurrentSession(updatedSession)

            // Update sessions list metadata
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === updatedSession.id
                        ? {
                              ...s,
                              title: updatedSession.title,
                              updatedAt: updatedSession.updatedAt,
                              messageCount: updatedSession.messages.length,
                              activeEngineId: updatedSession.activeEngineId,
                              hasDrawio:
                                  !!updatedSession.drawioXml &&
                                  updatedSession.drawioXml.trim().length > 0,
                              hasExcalidraw:
                                  Array.isArray(
                                      updatedSession.excalidrawScene?.elements,
                                  ) &&
                                  updatedSession.excalidrawScene.elements
                                      .length > 0,
                              thumbnailDataUrl: updatedSession.thumbnailDataUrl,
                          }
                        : s,
                ),
            )
        },
        [currentSession, currentSessionId, refreshSessions, activeEngineId],
    )

    // Clear current session state (for starting fresh without loading another session)
    const clearCurrentSession = useCallback(() => {
        setCurrentSession(null)
        setCurrentSessionId(null)
    }, [])
    
    // 跳过下一次 URL 同步（用于引擎切换时防止旧会话被重新加载）
    const skipNextUrlSync = useCallback(() => {
        skipNextUrlSyncRef.current = true
    }, [])

    // 重命名会话
    const renameSession = useCallback(
        async (id: string, newTitle: string): Promise<void> => {
            if (!isIndexedDBAvailable()) return

            try {
                // 获取会话
                const session = await getSession(id)
                if (!session) {
                    console.error("Session not found:", id)
                    return
                }

                // 更新标题
                const updatedSession: ChatSession = {
                    ...session,
                    title: newTitle,
                    updatedAt: Date.now(),
                }

                await saveSession(updatedSession)

                // 如果是当前会话，更新当前会话状态
                if (id === currentSessionId) {
                    setCurrentSession(updatedSession)
                }

                // 更新 sessions 列表
                setSessions((prev) =>
                    prev.map((s) =>
                        s.id === id
                            ? { ...s, title: newTitle, updatedAt: updatedSession.updatedAt }
                            : s
                    )
                )
            } catch (error) {
                console.error("Failed to rename session:", error)
            }
        },
        [currentSessionId]
    )

    return {
        sessions,
        currentSessionId,
        currentSession,
        isLoading,
        isAvailable,
        switchSession,
        deleteSession,
        renameSession,
        saveCurrentSession,
        refreshSessions,
        clearCurrentSession,
        skipNextUrlSync,
    }
}
