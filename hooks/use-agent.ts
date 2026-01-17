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
    /** 是否启用 Skill/引擎提示词注入 */
    isSkillEnabled?: boolean
    /** 获取画布主题 */
    getCanvasTheme?: () => string
    /** 工具调用处理器 */
    onToolCall?: (toolCall: any, addToolOutput: (params: ToolOutputParams) => void) => Promise<void>
    /** 外部错误处理器（用于显示 toast 等） */
    onExternalError?: (error: Error, type: AgentErrorType) => void
    
    // === 外部 Refs（支持与现有组件集成） ===
    
    /** 外部传入的 partialXmlRef（截断续传用） */
    partialXmlRef?: MutableRefObject<string>
    
    // === 画布状态回调（用于 regenerate/edit 时获取当前状态） ===
    
    /** 获取当前画布状态的回调 */
    getCurrentState?: () => Promise<string>
    
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
        isSkillEnabled = true,
        getCanvasTheme,
        onToolCall,
        onExternalError,
        // 外部 Refs
        partialXmlRef: externalPartialXmlRef,
        // 画布状态回调
        getCurrentState,
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
                    ...(!isSkillEnabled && { 'x-skill-disabled': 'true' }),
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
                    ...(!isSkillEnabled && { 'x-skill-disabled': 'true' }),
                    ...(engineId === 'excalidraw' && getCanvasTheme && {
                        'x-canvas-theme': getCanvasTheme(),
                    }),
                },
            }
        )
    }, [chatSendMessage, sessionId, engineId, minimalStyle, isSkillEnabled, getCanvasTheme, hooks, partialXmlRef])

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

        // 获取当前画布状态
        let currentState = ''
        if (getCurrentState) {
            try {
                currentState = await getCurrentState()
            } catch (error) {
                console.warn('[useAgent] Failed to get current state for regenerate:', error)
            }
        }

        // 截断消息并发送
        const newMessages = currentMessages.slice(0, userMessageIndex)
        flushSync(() => {
            setMessages(newMessages)
        })

        await sendChatMessageInternal(userParts, currentState, '')
    }, [isProcessing, getCurrentState, setMessages, sendChatMessageInternal])

    // === 编辑消息 ===
    const editMessage = useCallback(async (userMessageIndex: number, newText: string) => {
        if (isProcessing) return

        const currentMessages = messagesRef.current
        const message = currentMessages[userMessageIndex]
        if (!message || message.role !== 'user') return

        // 获取当前画布状态
        let currentState = ''
        if (getCurrentState) {
            try {
                currentState = await getCurrentState()
            } catch (error) {
                console.warn('[useAgent] Failed to get current state for edit:', error)
            }
        }

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

        await sendChatMessageInternal(newParts, currentState, '')
    }, [isProcessing, getCurrentState, setMessages, sendChatMessageInternal])

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

        setMessages(newMessages)
    }, [isProcessing, setMessages])

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
