"use client"

/**
 * useAgent - 智能体核心 Hook
 *
 * 封装 AI SDK 的 useChat，集成生命周期 hooks，提供统一的智能体 API。
 *
 * 架构说明：
 * - 封装 @ai-sdk/react 的 useChat
 * - 集成 AgentHooks 生命周期回调
 * - 提供消息操作方法 (regenerate, edit, delete)
 * - 管理重试逻辑
 *
 * @example
 * ```typescript
 * const agent = useAgent({
 *   engineId: 'excalidraw',
 *   sessionId: 'session-123',
 *   hooks: {
 *     beforeUserMessage: async ({ input }) => {
 *       await saveCanvasSnapshot()
 *     }
 *   }
 * })
 *
 * // 发送消息
 * await agent.sendMessage('画一个流程图')
 *
 * // 重新生成
 * await agent.regenerate(messageIndex)
 * ```
 */

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useCallback, useRef, type MutableRefObject } from "react"
import { flushSync } from "react-dom"
import { getApiEndpoint } from "@/shared/base-path"
import { getSelectedAIConfig } from "@/hooks/use-model-config"
import {
    type AgentHooks,
    type AgentErrorType,
    safeExecuteHook,
} from "./use-agent-hooks"

// ============ 常量 ============

const DEFAULT_MAX_AUTO_RETRY = 1
const DEFAULT_MAX_CONTINUATION_RETRY = 2

// ============ 类型定义 ============

/** 工具输出参数 */
export interface ToolOutputParams {
    tool: string
    toolCallId: string
    state?: 'output-available' | 'output-error'
    output?: any
    errorText?: string
}

/** 发送消息选项 */
export interface SendMessageOptions {
    /** 消息部分（支持多模态） */
    parts?: any[]
    /** 当前画布状态 */
    currentState?: string
    /** 之前画布状态 */
    previousState?: string
    /** 附加 headers */
    headers?: Record<string, string>
}

/**
 * 快照管理接口
 * 
 * 用途：管理每条用户消息发送时的画布状态快照，支持消息操作（regenerate/edit/delete）时恢复画布。
 * 
 * 重要区分：
 * - SnapshotManager：用于消息操作的画布状态回滚（内存中，按消息索引存储）
 * - 历史版本（Version History）：用户可视化的版本管理（持久化到 IndexedDB）
 * 
 * 工作原理：
 * 1. 用户发送消息前，当前画布状态（XML 字符串）被保存到 snapshot[messageIndex]
 * 2. 当用户点击「重新生成」或「编辑消息」时，从对应 snapshot 恢复画布
 * 3. 支持 DrawIO（XML）和 Excalidraw（通过 getCurrentState/restoreState 回调）
 * 
 * @example
 * ```
 * 消息 0 (user)  -> snapshot[0] = 空画布状态
 * 消息 1 (assistant)
 * 消息 2 (user)  -> snapshot[2] = 画布状态 A
 * 消息 3 (assistant)
 * 
 * 用户点击「重新生成消息 3」：
 * 1. 从 snapshot[2] 恢复画布到状态 A
 * 2. 截断消息到索引 2
 * 3. 重新发送用户问题
 * ```
 */
export interface SnapshotManager {
    /** 获取指定消息索引的快照 */
    get: (messageIndex: number) => string | undefined
    /** 设置指定消息索引的快照 */
    set: (messageIndex: number, snapshot: string) => void
    /** 删除指定消息索引的快照 */
    delete: (messageIndex: number) => void
    /** 获取所有快照的键 */
    keys: () => IterableIterator<number>
    /** 清理指定索引之后的所有快照 */
    cleanupAfter: (messageIndex: number) => void
    /** 重新索引快照（删除消息后调用） */
    reindex: (startIndex: number, removedCount: number) => void
}

/** 重试限制上下文 */
export interface RetryLimitContext {
    /** 重试类型 */
    type: 'auto' | 'continuation'
    /** 当前重试次数 */
    count: number
    /** 最大重试次数 */
    max: number
}

/** useAgent 配置选项 */
export interface UseAgentOptions {
    /** 引擎 ID */
    engineId: string
    /** 会话 ID */
    sessionId: string
    /** 生命周期 hooks */
    hooks?: AgentHooks
    /** API 端点 */
    apiEndpoint?: string
    /** 最大自动重试次数 */
    maxAutoRetry?: number
    /** 最大截断续传重试次数 */
    maxContinuationRetry?: number
    /** 是否使用简洁风格 */
    minimalStyle?: boolean
    /** 获取画布主题 */
    getCanvasTheme?: () => string
    /** 工具调用处理器 */
    onToolCall?: (toolCall: any, addToolOutput: (params: ToolOutputParams) => void) => Promise<void>
    /** 外部错误处理器（用于显示 toast 等） */
    onExternalError?: (error: Error, type: AgentErrorType) => void
    
    // === 外部 Refs（支持与现有组件集成） ===
    
    /** 外部传入的 partialXmlRef（截断续传用） */
    partialXmlRef?: MutableRefObject<string>
    
    // === 快照管理 ===
    
    /** 快照管理器（用于 regenerate/edit/delete 操作） */
    snapshotManager?: SnapshotManager
    /** 获取当前画布状态的回调 */
    getCurrentState?: () => Promise<string>
    /** 恢复画布状态的回调 */
    restoreState?: (state: string) => void
    
    // === 扩展回调 ===
    
    /** 重试次数达到上限时的回调 */
    onRetryLimitReached?: (context: RetryLimitContext) => void
}

/** useAgent 返回值 */
export interface UseAgentReturn {
    // === 状态 ===
    /** 消息列表 */
    messages: any[]
    /** 当前状态 */
    status: 'ready' | 'streaming' | 'submitted'
    /** 错误信息 */
    error: Error | null
    /** 是否正在处理中 */
    isProcessing: boolean

    // === 消息操作 ===
    /** 发送消息 */
    sendMessage: (input: string, options?: SendMessageOptions) => Promise<void>
    /** 重新生成指定 assistant 消息 */
    regenerate: (assistantMessageIndex: number) => Promise<void>
    /** 编辑指定 user 消息并重新发送 */
    editMessage: (userMessageIndex: number, newText: string) => Promise<void>
    /** 删除指定消息（及其配对消息） */
    deleteMessage: (messageIndex: number) => void
    /** 停止生成 */
    stop: () => void
    /** 设置消息列表 */
    setMessages: (messages: any[]) => void
    /** 添加工具输出 */
    addToolOutput: (params: ToolOutputParams) => void

    // === Hooks 触发器（供外部调用） ===
    /** 触发 beforeUserMessage hook */
    triggerBeforeUserMessage: (context: {
        input: string
        files: File[]
        currentState: string
    }) => Promise<void>
    
    // === Refs 访问（供外部组件使用） ===
    /** partialXmlRef 访问 */
    partialXmlRef: MutableRefObject<string>
}

// ============ 工具函数 ============

/**
 * 创建快照管理器
 * 
 * 将 Map<number, string> ref 封装为 SnapshotManager 接口。
 * 
 * 注意：
 * - 快照内容由调用方决定（通常是 DrawIO 的 XML 字符串）
 * - 对于 Excalidraw，需要通过 getCurrentState/restoreState 回调处理
 * - 快照仅存储在内存中，不会触发历史版本保存
 * 
 * @param mapRef - 存储快照的 Map ref，键为消息索引，值为画布状态字符串
 * 
 * @example
 * ```typescript
 * // 在 chat-panel.tsx 中使用
 * const xmlSnapshotsRef = useRef<Map<number, string>>(new Map())
 * const snapshotManager = useMemo(
 *   () => createSnapshotManager(xmlSnapshotsRef),
 *   []
 * )
 * 
 * // 传入 useAgent
 * useAgent({
 *   snapshotManager,
 *   getCurrentState: async () => await onFetchChart(),  // 获取当前画布
 *   restoreState: (xml) => onDisplayChart(xml),          // 恢复画布
 * })
 * ```
 */
export function createSnapshotManager(
    mapRef: MutableRefObject<Map<number, string>>
): SnapshotManager {
    return {
        get: (messageIndex: number) => mapRef.current.get(messageIndex),
        set: (messageIndex: number, snapshot: string) => mapRef.current.set(messageIndex, snapshot),
        delete: (messageIndex: number) => mapRef.current.delete(messageIndex),
        keys: () => mapRef.current.keys(),
        cleanupAfter: (messageIndex: number) => {
            for (const key of mapRef.current.keys()) {
                if (key > messageIndex) {
                    mapRef.current.delete(key)
                }
            }
        },
        reindex: (startIndex: number, removedCount: number) => {
            const updatedSnapshots = new Map<number, string>()
            for (const [key, value] of mapRef.current.entries()) {
                if (key < startIndex) {
                    updatedSnapshots.set(key, value)
                } else if (key >= startIndex + removedCount) {
                    updatedSnapshots.set(key - removedCount, value)
                }
            }
            mapRef.current = updatedSnapshots
        },
    }
}

/**
 * 解析错误类型
 */
function parseErrorType(error: Error): AgentErrorType {
    const message = error.message

    // 尝试解析 JSON 错误
    try {
        const data = JSON.parse(message)
        if (data.type === 'request' || data.type === 'token' || data.type === 'tpm') {
            return 'quota'
        }
    } catch {
        // 不是 JSON，继续检查
    }

    // 字符串匹配
    if (message.includes('Daily request limit') ||
        message.includes('Daily token limit') ||
        message.includes('Rate limit exceeded') ||
        message.includes('tokens per minute')) {
        return 'quota'
    }

    if (message === 'Failed to fetch' ||
        message.includes('Network error')) {
        return 'network'
    }

    if (message.includes('toolUse.input is invalid')) {
        return 'model'
    }

    return 'unknown'
}

/**
 * 检查最后一个工具调用是否有错误
 */
function hasToolErrors(messages: any[]): boolean {
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== 'assistant') {
        return false
    }

    const toolParts = lastMessage.parts?.filter((part: any) =>
        part.type?.startsWith('tool-')
    ) || []

    if (toolParts.length === 0) {
        return false
    }

    const lastToolPart = toolParts[toolParts.length - 1]
    return lastToolPart?.state === 'output-error'
}

// ============ Hook 实现 ============

export function useAgent(options: UseAgentOptions): UseAgentReturn {
    const {
        engineId,
        sessionId,
        hooks = {},
        apiEndpoint = getApiEndpoint('/api/chat'),
        maxAutoRetry = DEFAULT_MAX_AUTO_RETRY,
        maxContinuationRetry = DEFAULT_MAX_CONTINUATION_RETRY,
        minimalStyle = false,
        getCanvasTheme,
        onToolCall,
        onExternalError,
        // 外部 Refs
        partialXmlRef: externalPartialXmlRef,
        // 快照管理
        snapshotManager,
        getCurrentState,
        restoreState,
        // 扩展回调
        onRetryLimitReached,
    } = options

    // === Refs ===
    const autoRetryCountRef = useRef(0)
    const continuationRetryCountRef = useRef(0)
    const internalPartialXmlRef = useRef<string>('')
    // 使用外部传入的 ref 或内部 ref
    const partialXmlRef = externalPartialXmlRef || internalPartialXmlRef
    const requestStartTimeRef = useRef<number>(0)
    // 用于跟踪最新 messages（避免闭包问题）
    const messagesRef = useRef<any[]>([])

    // === useChat 配置 ===
    const {
        messages,
        sendMessage: chatSendMessage,
        addToolOutput: chatAddToolOutput,
        status,
        error,
        setMessages,
        stop,
    } = useChat({
        transport: new DefaultChatTransport({ api: apiEndpoint }),

        onToolCall: async ({ toolCall }) => {
            // 触发 beforeToolCall hook
            await safeExecuteHook(
                hooks.beforeToolCall,
                {
                    toolName: toolCall.toolName,
                    toolCallId: toolCall.toolCallId,
                    input: toolCall.input,
                },
                'beforeToolCall'
            )

            // 执行工具调用
            if (onToolCall) {
                try {
                    await onToolCall(toolCall, (params) => {
                        // 根据结果触发对应 hook
                        if (params.state === 'output-error') {
                            safeExecuteHook(
                                hooks.afterToolCallError,
                                {
                                    toolName: params.tool,
                                    toolCallId: params.toolCallId,
                                    input: toolCall.input,
                                    error: new Error(params.errorText || 'Tool call failed'),
                                },
                                'afterToolCallError'
                            )
                        } else {
                            safeExecuteHook(
                                hooks.afterToolCallSuccess,
                                {
                                    toolName: params.tool,
                                    toolCallId: params.toolCallId,
                                    input: toolCall.input,
                                    output: params.output,
                                },
                                'afterToolCallSuccess'
                            )
                        }

                        chatAddToolOutput(params as any)
                    })
                } catch (err) {
                    await safeExecuteHook(
                        hooks.afterToolCallError,
                        {
                            toolName: toolCall.toolName,
                            toolCallId: toolCall.toolCallId,
                            input: toolCall.input,
                            error: err instanceof Error ? err : new Error(String(err)),
                        },
                        'afterToolCallError'
                    )
                }
            }
        },

        onError: async (err) => {
            const errorType = parseErrorType(err)
            const canRetry = errorType === 'network' || errorType === 'model'

            // 触发 onError hook
            await safeExecuteHook(
                hooks.onError,
                { error: err, type: errorType, canRetry },
                'onError'
            )

            // 调用外部错误处理器
            onExternalError?.(err, errorType)

            // 触发 onRequestComplete hook (失败)
            const duration = Date.now() - requestStartTimeRef.current
            await safeExecuteHook(
                hooks.onRequestComplete,
                { success: false, duration },
                'onRequestComplete'
            )
        },

        onFinish: async () => {
            // 触发 afterAIResponse hook
            await safeExecuteHook(
                hooks.afterAIResponse,
                {
                    success: true,
                    messageId: messages[messages.length - 1]?.id || '',
                    // TODO: 从响应中获取实际 usage
                },
                'afterAIResponse'
            )

            // 触发 onRequestComplete hook (成功)
            const duration = Date.now() - requestStartTimeRef.current
            await safeExecuteHook(
                hooks.onRequestComplete,
                { success: true, duration },
                'onRequestComplete'
            )
        },

        sendAutomaticallyWhen: ({ messages }) => {
            const isInContinuationMode = partialXmlRef.current.length > 0
            const shouldRetry = hasToolErrors(messages)

            if (!shouldRetry) {
                autoRetryCountRef.current = 0
                continuationRetryCountRef.current = 0
                partialXmlRef.current = ''
                return false
            }

            // 检查自定义重试逻辑
            if (hooks.shouldAutoRetry) {
                const context = {
                    error: new Error('Tool call failed'),
                    retryCount: isInContinuationMode
                        ? continuationRetryCountRef.current
                        : autoRetryCountRef.current,
                    maxRetries: isInContinuationMode
                        ? maxContinuationRetry
                        : maxAutoRetry,
                }
                if (!hooks.shouldAutoRetry(context)) {
                    return false
                }
            }

            // 默认重试逻辑
            if (isInContinuationMode) {
                if (continuationRetryCountRef.current >= maxContinuationRetry) {
                    // 触发重试限制回调
                    onRetryLimitReached?.({
                        type: 'continuation',
                        count: continuationRetryCountRef.current,
                        max: maxContinuationRetry,
                    })
                    continuationRetryCountRef.current = 0
                    partialXmlRef.current = ''
                    return false
                }
                continuationRetryCountRef.current++
            } else {
                if (autoRetryCountRef.current >= maxAutoRetry) {
                    // 触发重试限制回调
                    onRetryLimitReached?.({
                        type: 'auto',
                        count: autoRetryCountRef.current,
                        max: maxAutoRetry,
                    })
                    autoRetryCountRef.current = 0
                    partialXmlRef.current = ''
                    return false
                }
                autoRetryCountRef.current++
            }

            return true
        },
    })

    // 同步 messagesRef
    messagesRef.current = messages

    // 计算是否正在处理中
    const isProcessing = status === 'streaming' || status === 'submitted'

    // === 发送消息 ===
    const sendMessage = useCallback(async (
        input: string,
        options: SendMessageOptions = {}
    ) => {
        const {
            parts = [{ type: 'text', text: input }],
            currentState = '',
            previousState = '',
            headers = {},
        } = options

        // 重置重试状态
        autoRetryCountRef.current = 0
        continuationRetryCountRef.current = 0
        partialXmlRef.current = ''

        // 记录开始时间
        requestStartTimeRef.current = Date.now()

        // 触发 onAIResponseStart hook
        hooks.onAIResponseStart?.()

        // 构建请求配置
        const config = getSelectedAIConfig()

        await chatSendMessage(
            { parts },
            {
                body: {
                    xml: currentState,
                    previousXml: previousState,
                    currentState,
                    previousState,
                    sessionId,
                    engineId,
                },
                headers: {
                    'x-access-code': config.accessCode,
                    ...(config.aiProvider && {
                        'x-ai-provider': config.aiProvider,
                        ...(config.aiBaseUrl && { 'x-ai-base-url': config.aiBaseUrl }),
                        ...(config.aiApiKey && { 'x-ai-api-key': config.aiApiKey }),
                        ...(config.aiModel && { 'x-ai-model': config.aiModel }),
                        ...(config.awsAccessKeyId && { 'x-aws-access-key-id': config.awsAccessKeyId }),
                        ...(config.awsSecretAccessKey && { 'x-aws-secret-access-key': config.awsSecretAccessKey }),
                        ...(config.awsRegion && { 'x-aws-region': config.awsRegion }),
                        ...(config.awsSessionToken && { 'x-aws-session-token': config.awsSessionToken }),
                    }),
                    ...(minimalStyle && { 'x-minimal-style': 'true' }),
                    ...(engineId === 'excalidraw' && getCanvasTheme && {
                        'x-canvas-theme': getCanvasTheme(),
                    }),
                    ...headers,
                },
            }
        )

        // 触发 afterUserMessage hook
        await safeExecuteHook(
            hooks.afterUserMessage,
            {
                messageId: `msg-${Date.now()}`,
                parts,
            },
            'afterUserMessage'
        )
    }, [
        chatSendMessage,
        sessionId,
        engineId,
        minimalStyle,
        getCanvasTheme,
        hooks,
    ])

    // === 触发 beforeUserMessage hook ===
    const triggerBeforeUserMessage = useCallback(async (context: {
        input: string
        files: File[]
        currentState: string
    }) => {
        await safeExecuteHook(
            hooks.beforeUserMessage,
            {
                input: context.input,
                files: context.files,
                currentState: context.currentState,
                engineId,
                sessionId,
            },
            'beforeUserMessage'
        )
    }, [hooks, engineId, sessionId])

    // === 添加工具输出 ===
    const addToolOutput = useCallback((params: ToolOutputParams) => {
        chatAddToolOutput(params as any)
    }, [chatAddToolOutput])

    // === 内部发送消息（供 regenerate/editMessage 使用） ===
    const sendChatMessageInternal = useCallback(async (
        parts: any[],
        currentState: string,
        previousState: string,
    ) => {
        // 重置重试状态
        autoRetryCountRef.current = 0
        continuationRetryCountRef.current = 0
        partialXmlRef.current = ''

        // 记录开始时间
        requestStartTimeRef.current = Date.now()

        // 触发 onAIResponseStart hook
        hooks.onAIResponseStart?.()

        const config = getSelectedAIConfig()

        await chatSendMessage(
            { parts },
            {
                body: {
                    xml: currentState,
                    previousXml: previousState,
                    currentState,
                    previousState,
                    sessionId,
                    engineId,
                },
                headers: {
                    'x-access-code': config.accessCode,
                    ...(config.aiProvider && {
                        'x-ai-provider': config.aiProvider,
                        ...(config.aiBaseUrl && { 'x-ai-base-url': config.aiBaseUrl }),
                        ...(config.aiApiKey && { 'x-ai-api-key': config.aiApiKey }),
                        ...(config.aiModel && { 'x-ai-model': config.aiModel }),
                        ...(config.awsAccessKeyId && { 'x-aws-access-key-id': config.awsAccessKeyId }),
                        ...(config.awsSecretAccessKey && { 'x-aws-secret-access-key': config.awsSecretAccessKey }),
                        ...(config.awsRegion && { 'x-aws-region': config.awsRegion }),
                        ...(config.awsSessionToken && { 'x-aws-session-token': config.awsSessionToken }),
                    }),
                    ...(minimalStyle && { 'x-minimal-style': 'true' }),
                    ...(engineId === 'excalidraw' && getCanvasTheme && {
                        'x-canvas-theme': getCanvasTheme(),
                    }),
                },
            }
        )
    }, [chatSendMessage, sessionId, engineId, minimalStyle, getCanvasTheme, hooks, partialXmlRef])

    // === 获取指定索引之前的快照 ===
    const getPreviousSnapshot = useCallback((beforeIndex: number): string => {
        if (!snapshotManager) return ''
        
        const keys = Array.from(snapshotManager.keys())
            .filter((k) => k < beforeIndex)
            .sort((a, b) => b - a)
        
        return keys.length > 0 ? (snapshotManager.get(keys[0]) || '') : ''
    }, [snapshotManager])

    // === 重新生成 ===
    const regenerate = useCallback(async (assistantMessageIndex: number) => {
        if (isProcessing) return
        
        const currentMessages = messagesRef.current
        const assistantMessage = currentMessages[assistantMessageIndex]
        if (!assistantMessage || assistantMessage.role !== 'assistant') return

        // 找到此 assistant 消息之前的 user 消息
        let userMessageIndex = assistantMessageIndex - 1
        while (userMessageIndex >= 0 && currentMessages[userMessageIndex].role !== 'user') {
            userMessageIndex--
        }
        if (userMessageIndex < 0) return

        const userMessage = currentMessages[userMessageIndex]
        const userParts = userMessage.parts

        // 获取文本部分
        const textPart = userParts?.find((p: any) => p.type === 'text')
        if (!textPart) return

        // 获取保存的快照
        let savedState = snapshotManager?.get(userMessageIndex)
        if (!savedState && getCurrentState) {
            try {
                savedState = await getCurrentState()
            } catch (error) {
                console.warn('[useAgent] Failed to get current state for regenerate:', error)
                savedState = ''
            }
        }

        // 获取之前的状态并恢复画布
        const previousState = getPreviousSnapshot(userMessageIndex)
        if (savedState && restoreState) {
            restoreState(savedState)
        }

        // 清理后续快照
        snapshotManager?.cleanupAfter(userMessageIndex)

        // 截断消息并发送
        const newMessages = currentMessages.slice(0, userMessageIndex)
        flushSync(() => {
            setMessages(newMessages)
        })

        await sendChatMessageInternal(userParts, savedState || '', previousState)
    }, [isProcessing, snapshotManager, getCurrentState, restoreState, getPreviousSnapshot, setMessages, sendChatMessageInternal])

    // === 编辑消息 ===
    const editMessage = useCallback(async (userMessageIndex: number, newText: string) => {
        if (isProcessing) return

        const currentMessages = messagesRef.current
        const message = currentMessages[userMessageIndex]
        if (!message || message.role !== 'user') return

        // 获取保存的快照
        let savedState = snapshotManager?.get(userMessageIndex)
        if (!savedState && getCurrentState) {
            try {
                savedState = await getCurrentState()
            } catch (error) {
                console.warn('[useAgent] Failed to get current state for edit:', error)
                savedState = ''
            }
        }

        // 获取之前的状态并恢复画布
        const previousState = getPreviousSnapshot(userMessageIndex)
        if (savedState && restoreState) {
            restoreState(savedState)
        }

        // 清理后续快照
        snapshotManager?.cleanupAfter(userMessageIndex)

        // 创建新的 parts
        const newParts = message.parts?.map((part: any) => {
            if (part.type === 'text') {
                return { ...part, text: newText }
            }
            return part
        }) || [{ type: 'text', text: newText }]

        // 截断消息并发送
        const newMessages = currentMessages.slice(0, userMessageIndex)
        flushSync(() => {
            setMessages(newMessages)
        })

        await sendChatMessageInternal(newParts, savedState || '', previousState)
    }, [isProcessing, snapshotManager, getCurrentState, restoreState, getPreviousSnapshot, setMessages, sendChatMessageInternal])

    // === 删除消息 ===
    const deleteMessage = useCallback((messageIndex: number) => {
        if (isProcessing) return

        const currentMessages = messagesRef.current
        const message = currentMessages[messageIndex]
        if (!message) return

        // 确定删除范围
        let startIndex = messageIndex
        let endIndex = messageIndex + 1

        if (message.role === 'user') {
            // 如果删除 user 消息，同时删除后面的 assistant 消息
            const nextMessage = currentMessages[messageIndex + 1]
            if (nextMessage && nextMessage.role === 'assistant') {
                endIndex = messageIndex + 2
            }
        }

        // 创建新消息数组
        const newMessages = [
            ...currentMessages.slice(0, startIndex),
            ...currentMessages.slice(endIndex)
        ]

        // 清理删除消息的快照
        if (snapshotManager) {
            for (let i = startIndex; i < currentMessages.length; i++) {
                snapshotManager.delete(i)
            }

            // 重新索引剩余快照
            if (endIndex < currentMessages.length) {
                const removedCount = endIndex - startIndex
                snapshotManager.reindex(startIndex, removedCount)
            }
        }

        setMessages(newMessages)
    }, [isProcessing, snapshotManager, setMessages])

    return {
        // 状态
        messages,
        status: status as 'ready' | 'streaming' | 'submitted',
        error: error || null,
        isProcessing,

        // 操作
        sendMessage,
        regenerate,
        editMessage,
        deleteMessage,
        stop,
        setMessages,
        addToolOutput,

        // Hooks 触发器
        triggerBeforeUserMessage,
        
        // Refs 访问
        partialXmlRef,
    }
}

// ============ 导出类型 ============

export type {
    AgentHooks,
    AgentErrorType,
} from './use-agent-hooks'
