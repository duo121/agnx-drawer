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
    xmlSnapshots: [number, string][]
    diagramXml: string
    excalidrawScene?: any
    thumbnailDataUrl?: string
    diagramHistory?: { svg: string; xml: string; timestamp?: number; isManual?: boolean }[]
    excalidrawHistory?: any[]
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
    engineId?: string
}

export function useSessionManager(
    options: UseSessionManagerOptions = {},
): UseSessionManagerReturn {
    const { initialSessionId, engineId } = options
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
                // 不修改 engineId,保持会话原有的引擎类型
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
                xmlSnapshots: session.xmlSnapshots,
                diagramXml: session.diagramXml,
                thumbnailDataUrl: session.thumbnailDataUrl,
                diagramHistory: session.diagramHistory,
                excalidrawScene: session.excalidrawScene,
                excalidrawHistory: session.excalidrawHistory,
            }
        },
        [currentSessionId, currentSession, engineId],
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
                currentSessionEngineId: currentSession?.engineId,
                dataMessagesCount: data.messages?.length,
                dataDiagramXmlLength: data.diagramXml?.length,
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
                // 新会话必须有 engineId,且一旦设置就不能修改
                if (!engineId) {
                    console.error('[saveCurrentSession] Cannot create session without engineId')
                    return
                }
                const newSession: ChatSession = {
                    ...createEmptySession(),
                    messages: data.messages,
                    xmlSnapshots: data.xmlSnapshots,
                    diagramXml: data.diagramXml,
                    excalidrawScene: data.excalidrawScene,
                    excalidrawHistory: data.excalidrawHistory,
                    thumbnailDataUrl: data.thumbnailDataUrl,
                    diagramHistory: data.diagramHistory,
                    title: extractTitle(data.messages),
                    engineId,
                }
                await saveSession(newSession)
                await enforceSessionLimit()
                setCurrentSession(newSession)
                setCurrentSessionId(newSession.id)
                await refreshSessions()
                return
            }

            // Update existing session
            const updatedSession: ChatSession = {
                ...currentSession,
                messages: data.messages,
                xmlSnapshots: data.xmlSnapshots,
                diagramXml: data.diagramXml,
                excalidrawScene: data.excalidrawScene ?? currentSession.excalidrawScene,
                excalidrawHistory: data.excalidrawHistory ?? currentSession.excalidrawHistory,
                thumbnailDataUrl:
                    data.thumbnailDataUrl ?? currentSession.thumbnailDataUrl,
                diagramHistory:
                    data.diagramHistory ?? currentSession.diagramHistory,
                updatedAt: Date.now(),
                // IMPORTANT: engineId 一旦设置就不能修改,永远使用会话原有的 engineId
                engineId: currentSession.engineId,
                // Update title if it's still default and we have messages
                title:
                    currentSession.title === "New Chat" &&
                    data.messages.length > 0
                        ? extractTitle(data.messages)
                        : currentSession.title,
            }

            console.log('[saveCurrentSession] Saving updated session:', {
                sessionId: updatedSession.id,
                engineId: updatedSession.engineId,
                messagesCount: updatedSession.messages.length,
                diagramXmlLength: updatedSession.diagramXml?.length,
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
                            engineId: updatedSession.engineId,
                            hasDiagram:
                                  (!!updatedSession.diagramXml &&
                                      updatedSession.diagramXml.trim().length >
                                          0) ||
                                  (Array.isArray(
                                      updatedSession.excalidrawScene?.elements,
                                  ) &&
                                      updatedSession.excalidrawScene.elements
                                          .length > 0),
                            thumbnailDataUrl: updatedSession.thumbnailDataUrl,
                        }
                        : s,
                ),
            )
        },
        [currentSession, currentSessionId, refreshSessions, engineId],
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

    return {
        sessions,
        currentSessionId,
        currentSession,
        isLoading,
        isAvailable,
        switchSession,
        deleteSession,
        saveCurrentSession,
        refreshSessions,
        clearCurrentSession,
        skipNextUrlSync,
    }
}
