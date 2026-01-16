/**
 * Agent Hooks - 智能体生命周期 Hook 定义
 *
 * 提供可插拔的 hook 机制，用于在智能体生命周期的各个阶段执行自定义逻辑。
 * 类似 Claude Code 的 hook 设计。
 *
 * @example
 * ```typescript
 * const hooks: AgentHooks = {
 *   beforeUserMessage: async ({ input }) => {
 *     console.log('User is sending:', input)
 *   },
 *   afterToolCallSuccess: ({ toolName, output }) => {
 *     console.log(`Tool ${toolName} succeeded`)
 *   }
 * }
 * ```
 */

// ============ 上下文类型 ============

/** 用户消息上下文 */
export interface BeforeUserMessageContext {
    /** 用户输入文本 */
    input: string
    /** 附件文件 */
    files: File[]
    /** 当前画布状态 (XML 或 JSON) */
    currentState: string
    /** 当前引擎 ID */
    engineId: string
    /** 会话 ID */
    sessionId: string
}

/** 用户消息发送后上下文 */
export interface AfterUserMessageContext {
    /** 消息 ID */
    messageId: string
    /** 消息内容部分 */
    parts: any[]
}

/** AI 响应上下文 */
export interface AfterAIResponseContext {
    /** 是否成功 */
    success: boolean
    /** 消息 ID */
    messageId: string
    /** Token 使用量 */
    usage?: {
        inputTokens: number
        outputTokens: number
    }
}

/** 工具调用上下文 */
export interface ToolCallContext {
    /** 工具名称 */
    toolName: string
    /** 工具调用 ID */
    toolCallId: string
    /** 工具输入 */
    input: any
}

/** 工具成功上下文 */
export interface AfterToolCallSuccessContext extends ToolCallContext {
    /** 工具输出 */
    output: any
}

/** 工具失败上下文 */
export interface AfterToolCallErrorContext extends ToolCallContext {
    /** 错误信息 */
    error: Error
}

/** 错误类型 */
export type AgentErrorType = 'quota' | 'network' | 'model' | 'tool' | 'unknown'

/** 错误上下文 */
export interface OnErrorContext {
    /** 错误对象 */
    error: Error
    /** 错误类型 */
    type: AgentErrorType
    /** 是否可重试 */
    canRetry: boolean
}

/** 重试上下文 */
export interface ShouldAutoRetryContext {
    /** 错误对象 */
    error: Error
    /** 当前重试次数 */
    retryCount: number
    /** 最大重试次数 */
    maxRetries: number
}

/** 请求完成上下文 */
export interface OnRequestCompleteContext {
    /** 是否成功 */
    success: boolean
    /** 请求耗时 (ms) */
    duration: number
}

// ============ Hook 类型 ============

/**
 * 智能体生命周期 Hooks
 *
 * 所有 hook 都是可选的，支持同步和异步函数。
 */
export interface AgentHooks {
    // === 用户消息生命周期 ===

    /**
     * 用户消息发送前
     *
     * 适合执行：
     * - 输入校验
     * - 保存画布快照/历史版本
     * - 准备上下文
     */
    beforeUserMessage?: (context: BeforeUserMessageContext) => void | Promise<void>

    /**
     * 用户消息发送后
     *
     * 适合执行：
     * - 消息日志
     * - UI 更新
     */
    afterUserMessage?: (context: AfterUserMessageContext) => void | Promise<void>

    // === AI 响应生命周期 ===

    /**
     * AI 开始响应
     *
     * 适合执行：
     * - 显示加载状态
     * - 开始计时
     */
    onAIResponseStart?: () => void

    /**
     * AI 响应完成
     *
     * 适合执行：
     * - Token 统计
     * - 会话保存
     * - 完成通知
     */
    afterAIResponse?: (context: AfterAIResponseContext) => void | Promise<void>

    // === 工具调用生命周期 ===

    /**
     * 工具调用前
     *
     * 适合执行：
     * - 工具调用日志
     * - 权限检查
     */
    beforeToolCall?: (context: ToolCallContext) => void | Promise<void>

    /**
     * 工具调用成功后
     *
     * 适合执行：
     * - 成功日志
     * - 状态更新
     */
    afterToolCallSuccess?: (context: AfterToolCallSuccessContext) => void | Promise<void>

    /**
     * 工具调用失败后
     *
     * 适合执行：
     * - 错误日志
     * - 错误恢复
     */
    afterToolCallError?: (context: AfterToolCallErrorContext) => void | Promise<void>

    // === 错误处理 ===

    /**
     * 错误发生时
     *
     * 适合执行：
     * - 错误上报
     * - 用户提示
     * - 自动恢复
     */
    onError?: (context: OnErrorContext) => void | Promise<void>

    // === 重试控制 ===

    /**
     * 是否应该自动重试
     *
     * 返回 true 表示应该重试，false 表示不重试。
     * 如果未定义，使用默认重试逻辑。
     */
    shouldAutoRetry?: (context: ShouldAutoRetryContext) => boolean

    // === 请求完成 ===

    /**
     * 整个请求完成后（无论成功失败）
     *
     * 适合执行：
     * - 性能统计
     * - 清理工作
     */
    onRequestComplete?: (context: OnRequestCompleteContext) => void | Promise<void>
}

// ============ 工具函数 ============

/**
 * 合并多个 hooks 对象
 *
 * 同名 hook 会按顺序执行（不是覆盖）。
 *
 * @example
 * ```typescript
 * const hooks = mergeHooks(
 *   defaultHooks,
 *   loggingHooks,
 *   customHooks
 * )
 * ```
 */
export function mergeHooks(...hooksList: (AgentHooks | undefined)[]): AgentHooks {
    const merged: AgentHooks = {}

    const hookNames: (keyof AgentHooks)[] = [
        'beforeUserMessage',
        'afterUserMessage',
        'onAIResponseStart',
        'afterAIResponse',
        'beforeToolCall',
        'afterToolCallSuccess',
        'afterToolCallError',
        'onError',
        'shouldAutoRetry',
        'onRequestComplete',
    ]

    for (const hookName of hookNames) {
        const handlers = hooksList
            .filter((hooks): hooks is AgentHooks => hooks !== undefined)
            .map(hooks => hooks[hookName])
            .filter((handler): handler is NonNullable<typeof handler> => handler !== undefined)

        if (handlers.length === 0) continue

        if (hookName === 'shouldAutoRetry') {
            // shouldAutoRetry 返回布尔值，使用最后一个的结果
            merged.shouldAutoRetry = (context: ShouldAutoRetryContext) => {
                let result = true
                for (const handler of handlers) {
                    result = (handler as (ctx: ShouldAutoRetryContext) => boolean)(context)
                }
                return result
            }
        } else {
            // 其他 hooks 依次执行
            (merged as any)[hookName] = async (context: any) => {
                for (const handler of handlers) {
                    await (handler as (ctx: any) => void | Promise<void>)(context)
                }
            }
        }
    }

    return merged
}

/**
 * 创建日志 hooks（开发调试用）
 */
export function createLoggingHooks(prefix = '[Agent]'): AgentHooks {
    return {
        beforeUserMessage: ({ input, engineId }) => {
            console.log(`${prefix} beforeUserMessage:`, { input: input.slice(0, 50), engineId })
        },
        afterUserMessage: ({ messageId }) => {
            console.log(`${prefix} afterUserMessage:`, { messageId })
        },
        onAIResponseStart: () => {
            console.log(`${prefix} onAIResponseStart`)
        },
        afterAIResponse: ({ success, usage }) => {
            console.log(`${prefix} afterAIResponse:`, { success, usage })
        },
        beforeToolCall: ({ toolName, toolCallId }) => {
            console.log(`${prefix} beforeToolCall:`, { toolName, toolCallId })
        },
        afterToolCallSuccess: ({ toolName, toolCallId }) => {
            console.log(`${prefix} afterToolCallSuccess:`, { toolName, toolCallId })
        },
        afterToolCallError: ({ toolName, error }) => {
            console.log(`${prefix} afterToolCallError:`, { toolName, error: error.message })
        },
        onError: ({ error, type }) => {
            console.log(`${prefix} onError:`, { type, error: error.message })
        },
        onRequestComplete: ({ success, duration }) => {
            console.log(`${prefix} onRequestComplete:`, { success, duration: `${duration}ms` })
        },
    }
}

/**
 * 空 hooks（不执行任何操作）
 */
export const emptyHooks: AgentHooks = {}

/**
 * 安全执行 hook（捕获错误不影响主流程）
 */
export async function safeExecuteHook<T>(
    hook: ((context: T) => void | Promise<void>) | undefined,
    context: T,
    hookName: string
): Promise<void> {
    if (!hook) return
    
    try {
        await hook(context)
    } catch (error) {
        console.error(`[AgentHooks] Error in ${hookName}:`, error)
    }
}
