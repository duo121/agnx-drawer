import { type DBSchema, type IDBPDatabase, openDB } from "idb"
import { nanoid } from "nanoid"

// Constants
const DB_NAME = "next-ai-drawio"
const DB_VERSION = 4
const STORE_NAME = "sessions"
const MIGRATION_FLAG = "next-ai-drawio-migrated-to-idb"
const MAX_SESSIONS = 50

// Types
export interface ChatSession {
    id: string
    title: string
    /** 最后使用的引擎，用于加载会话时恢复视图 */
    activeEngineId?: string
    createdAt: number
    updatedAt: number
    messages: StoredMessage[]
    /** DrawIO 图表 XML */
    drawioXml: string
    /** DrawIO 历史版本 */
    drawioHistory?: DrawioHistoryEntry[]
    /** Excalidraw 场景 (elements/appState/files) */
    excalidrawScene?: ExcalidrawScene
    /** Excalidraw 历史版本 */
    excalidrawHistory?: ExcalidrawHistoryEntry[]
    /** 缩略图 (当前激活引擎的预览) */
    thumbnailDataUrl?: string
}

// DrawIO history entry for version tracking
export interface DrawioHistoryEntry {
    svg: string
    xml: string
    timestamp?: number // Creation timestamp
    isManual?: boolean // Whether this was manually saved by user
}

export interface StoredMessage {
    id: string
    role: "user" | "assistant" | "system"
    parts: Array<{ type: string; [key: string]: unknown }>
}

export interface SessionMetadata {
    id: string
    title: string
    createdAt: number
    updatedAt: number
    messageCount: number
    /** 是否有 DrawIO 图表 */
    hasDrawio: boolean
    /** 是否有 Excalidraw 图表 */
    hasExcalidraw: boolean
    thumbnailDataUrl?: string
    /** 最后使用的引擎 */
    activeEngineId?: string
}

// Minimal Excalidraw scene structure for persistence
export interface ExcalidrawScene {
    elements: any[]
    appState?: any
    files?: Record<string, any>
}

// Excalidraw history entry for version tracking
export interface ExcalidrawHistoryEntry {
    timestamp: number // Creation timestamp
    label?: string // Optional label (e.g., "Before AI edit")
    scene: ExcalidrawScene // Scene snapshot
    thumbnailDataUrl?: string // Thumbnail preview
    isManual?: boolean // Whether this was manually saved by user (vs auto-saved)
}

interface ChatSessionDB extends DBSchema {
    sessions: {
        key: string
        value: ChatSession
        indexes: { "by-updated": number }
    }
}

// Database singleton
let dbPromise: Promise<IDBPDatabase<ChatSessionDB>> | null = null

async function getDB(): Promise<IDBPDatabase<ChatSessionDB>> {
    if (!dbPromise) {
        dbPromise = openDB<ChatSessionDB>(DB_NAME, DB_VERSION, {
            async upgrade(db, oldVersion, _newVersion, transaction) {
                const store =
                    oldVersion < 1
                        ? (() => {
                              const created = db.createObjectStore(
                                  STORE_NAME,
                                  { keyPath: "id" },
                              )
                              created.createIndex("by-updated", "updatedAt")
                              return created
                          })()
                        : transaction.objectStore(STORE_NAME)

                if (oldVersion < 2) {
                    // Backfill legacy sessions with default engine
                    let cursor = await store.openCursor()
                    while (cursor) {
                        if (!(cursor.value as any).engineId) {
                            const updated = {
                                ...cursor.value,
                                engineId: "drawio",
                            }
                            await cursor.update(updated)
                        }
                        cursor = await cursor.continue()
                    }
                }
                if (oldVersion < 3) {
                    // No structural changes; excalidrawScene is optional.
                    // Existing records remain valid.
                }
                if (oldVersion < 4) {
                    // V4: 双引擎会话架构
                    // - diagramXml → drawioXml
                    // - diagramHistory → drawioHistory  
                    // - engineId → activeEngineId
                    // - 移除 by-engine 索引
                    
                    // 删除旧索引（如果存在）
                    // Note: by-engine 索引在 V2 时添加，现在不再需要
                    try {
                        const indexNames = Array.from(store.indexNames) as string[]
                        if (indexNames.includes("by-engine")) {
                            (store as any).deleteIndex("by-engine")
                        }
                    } catch {
                        // 索引可能不存在，忽略错误
                    }
                    
                    // 迁移数据字段
                    let cursor = await store.openCursor()
                    while (cursor) {
                        const oldValue = cursor.value as any
                        const updated: any = { ...oldValue }
                        
                        // 重命名 diagramXml → drawioXml
                        if (oldValue.diagramXml !== undefined && oldValue.drawioXml === undefined) {
                            updated.drawioXml = oldValue.diagramXml
                            delete updated.diagramXml
                        }
                        
                        // 重命名 diagramHistory → drawioHistory
                        if (oldValue.diagramHistory !== undefined && oldValue.drawioHistory === undefined) {
                            updated.drawioHistory = oldValue.diagramHistory
                            delete updated.diagramHistory
                        }
                        
                        // 重命名 engineId → activeEngineId
                        if (oldValue.engineId !== undefined && oldValue.activeEngineId === undefined) {
                            updated.activeEngineId = oldValue.engineId
                            delete updated.engineId
                        }
                        
                        await cursor.update(updated)
                        cursor = await cursor.continue()
                    }
                }
            },
        })
    }
    return dbPromise
}

// Check if IndexedDB is available
export function isIndexedDBAvailable(): boolean {
    if (typeof window === "undefined") return false
    try {
        return "indexedDB" in window && window.indexedDB !== null
    } catch {
        return false
    }
}

// CRUD Operations
export async function getAllSessionMetadata(): Promise<SessionMetadata[]> {
    if (!isIndexedDBAvailable()) return []
    try {
        const db = await getDB()
        const tx = db.transaction(STORE_NAME, "readonly")
        const index = tx.store.index("by-updated")
        const metadata: SessionMetadata[] = []

        // Use cursor to read only metadata fields (avoids loading full messages/XML)
        let cursor = await index.openCursor(null, "prev") // newest first
        while (cursor) {
            const s = cursor.value
            metadata.push({
                id: s.id,
                title: s.title,
                createdAt: s.createdAt,
                updatedAt: s.updatedAt,
                messageCount: s.messages.length,
                hasDrawio: !!s.drawioXml && s.drawioXml.trim().length > 0,
                hasExcalidraw:
                    Array.isArray(s.excalidrawScene?.elements) &&
                    s.excalidrawScene.elements.length > 0,
                thumbnailDataUrl: s.thumbnailDataUrl,
                activeEngineId: s.activeEngineId,
            })
            cursor = await cursor.continue()
        }
        return metadata
    } catch (error) {
        console.error("Failed to get session metadata:", error)
        return []
    }
}


export async function getSession(id: string): Promise<ChatSession | null> {
    if (!isIndexedDBAvailable()) return null
    try {
        const db = await getDB()
        return (await db.get(STORE_NAME, id)) || null
    } catch (error) {
        console.error("Failed to get session:", error)
        return null
    }
}

export async function saveSession(session: ChatSession): Promise<boolean> {
    if (!isIndexedDBAvailable()) return false
    try {
        const db = await getDB()
        await db.put(STORE_NAME, session)
        return true
    } catch (error) {
        // Handle quota exceeded
        if (
            error instanceof DOMException &&
            error.name === "QuotaExceededError"
        ) {
            console.warn("Storage quota exceeded, deleting oldest session...")
            await deleteOldestSession()
            // Retry once
            try {
                const db = await getDB()
                await db.put(STORE_NAME, session)
                return true
            } catch (retryError) {
                console.error(
                    "Failed to save session after cleanup:",
                    retryError,
                )
                return false
            }
        } else {
            console.error("Failed to save session:", error)
            return false
        }
    }
}

export async function deleteSession(id: string): Promise<void> {
    if (!isIndexedDBAvailable()) return
    try {
        const db = await getDB()
        await db.delete(STORE_NAME, id)
    } catch (error) {
        console.error("Failed to delete session:", error)
    }
}

export async function getSessionCount(): Promise<number> {
    if (!isIndexedDBAvailable()) return 0
    try {
        const db = await getDB()
        return await db.count(STORE_NAME)
    } catch (error) {
        console.error("Failed to get session count:", error)
        return 0
    }
}

export async function deleteOldestSession(): Promise<void> {
    if (!isIndexedDBAvailable()) return
    try {
        const db = await getDB()
        const tx = db.transaction(STORE_NAME, "readwrite")
        const index = tx.store.index("by-updated")
        const cursor = await index.openCursor()
        if (cursor) {
            await cursor.delete()
        }
        await tx.done
    } catch (error) {
        console.error("Failed to delete oldest session:", error)
    }
}

// Enforce max sessions limit
export async function enforceSessionLimit(): Promise<void> {
    const count = await getSessionCount()
    if (count > MAX_SESSIONS) {
        const toDelete = count - MAX_SESSIONS
        for (let i = 0; i < toDelete; i++) {
            await deleteOldestSession()
        }
    }
}

// Helper: Create a new empty session
export function createEmptySession(activeEngineId?: string): ChatSession {
    return {
        id: nanoid(),
        title: "New Chat",
        activeEngineId: activeEngineId || "drawio",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        drawioXml: "",
        drawioHistory: [],
        excalidrawScene: {
            elements: [],
            appState: {
                theme: "dark",
            },
            files: {},
        },
        excalidrawHistory: [],
    }
}

// Helper: Extract title from first user message (truncated to reasonable length)
const MAX_TITLE_LENGTH = 100

export function extractTitle(messages: StoredMessage[]): string {
    const firstUserMessage = messages.find((m) => m.role === "user")
    if (!firstUserMessage) return "New Chat"

    const textPart = firstUserMessage.parts.find((p) => p.type === "text")
    if (!textPart || typeof textPart.text !== "string") return "New Chat"

    const text = textPart.text.trim()
    if (!text) return "New Chat"

    // Truncate long titles
    if (text.length > MAX_TITLE_LENGTH) {
        return text.slice(0, MAX_TITLE_LENGTH).trim() + "..."
    }
    return text
}

// Helper: Sanitize UIMessage to StoredMessage
export function sanitizeMessage(message: unknown): StoredMessage | null {
    if (!message || typeof message !== "object") return null

    const msg = message as Record<string, unknown>
    if (!msg.id || !msg.role) return null

    const role = msg.role as string
    if (!["user", "assistant", "system"].includes(role)) return null

    // Extract parts, removing streaming state artifacts
    let parts: Array<{ type: string; [key: string]: unknown }> = []
    if (Array.isArray(msg.parts)) {
        parts = msg.parts.map((part: unknown) => {
            if (!part || typeof part !== "object") return { type: "unknown" }
            const p = part as Record<string, unknown>
            // Remove streaming-related fields
            const { isStreaming, streamingState, ...cleanPart } = p
            return cleanPart as { type: string; [key: string]: unknown }
        })
    }

    return {
        id: msg.id as string,
        role: role as "user" | "assistant" | "system",
        parts,
    }
}

export function sanitizeMessages(messages: unknown[]): StoredMessage[] {
    return messages
        .map(sanitizeMessage)
        .filter((m): m is StoredMessage => m !== null)
}

// Migration from localStorage
export async function migrateFromLocalStorage(): Promise<string | null> {
    if (typeof window === "undefined") return null
    if (!isIndexedDBAvailable()) return null

    // Check if already migrated
    if (localStorage.getItem(MIGRATION_FLAG)) return null

    try {
        const savedMessages = localStorage.getItem("agnx-messages")
        const savedSnapshots = localStorage.getItem(
            "agnx-xml-snapshots",
        )
        const savedXml = localStorage.getItem("agnx-diagram-xml")

        let newSessionId: string | null = null
        let migrationSucceeded = false

        if (savedMessages) {
            const messages = JSON.parse(savedMessages)
            if (Array.isArray(messages) && messages.length > 0) {
                const sanitized = sanitizeMessages(messages)
                const session: ChatSession = {
                    id: nanoid(),
                    title: extractTitle(sanitized),
                    activeEngineId: "drawio", // 旧数据默认是 drawio
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    messages: sanitized,
                    drawioXml: savedXml || "",
                }
                const saved = await saveSession(session)
                if (saved) {
                    // Verify the session was actually written
                    const verified = await getSession(session.id)
                    if (verified) {
                        newSessionId = session.id
                        migrationSucceeded = true
                    }
                }
            } else {
                // Empty array or invalid data - nothing to migrate, mark as success
                migrationSucceeded = true
            }
        } else {
            // No data to migrate - mark as success
            migrationSucceeded = true
        }

        // Only clean up old data if migration succeeded
        if (migrationSucceeded) {
            localStorage.setItem(MIGRATION_FLAG, "true")
            localStorage.removeItem("agnx-messages")
            localStorage.removeItem("agnx-xml-snapshots")
            localStorage.removeItem("agnx-diagram-xml")
        } else {
            console.warn(
                "Migration to IndexedDB failed - keeping localStorage data for retry",
            )
        }

        return newSessionId
    } catch (error) {
        console.error("Migration failed:", error)
        // Don't mark as migrated - allow retry on next load
        return null
    }
}
