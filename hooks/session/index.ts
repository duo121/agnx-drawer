/**
 * Session 模块入口
 *
 * 提供会话存储和管理功能
 */

// ============ Storage 导出 ============

export {
    // Types
    type ChatSession,
    type StoredMessage,
    type SessionMetadata,
    type DrawioHistoryEntry,
    type ExcalidrawHistoryEntry,
    type ExcalidrawScene,
    type UnifiedHistoryEntry,
    // Functions
    isIndexedDBAvailable,
    migrateFromLocalStorage,
    createEmptySession,
    saveSession,
    getSession,
    deleteSession,
    getAllSessionMetadata,
    enforceSessionLimit,
    extractTitle,
    sanitizeMessages,
} from "./storage"

// ============ Hook 导出 ============

export { useSessionManager } from "./use-session-manager"
export type { UseSessionManagerReturn, SessionData } from "./use-session-manager"
