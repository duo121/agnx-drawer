/**
 * 工具基类
 * 所有工具都继承自此基类
 */

import { z } from "zod"

/**
 * 工具定义接口
 */
export interface ToolDefinition {
    name: string
    description: string
    inputSchema: z.ZodType<any>
}

/**
 * 工具执行结果
 */
export interface ToolResult {
    success: boolean
    output?: string
    error?: string
    content?: string
    [key: string]: any
}

/**
 * 工具基类
 */
export abstract class BaseTool<TInput = unknown, TOutput extends ToolResult = ToolResult> {
    abstract name: string
    abstract description: string

    /**
     * 获取输入 schema
     */
    abstract getInputSchema(): z.ZodType<TInput>

    /**
     * 执行工具
     */
    abstract execute(input: TInput): Promise<TOutput>

    /**
     * 获取工具定义（用于 AI SDK）
     */
    getDefinition(): ToolDefinition {
        return {
            name: this.name,
            description: this.description,
            inputSchema: this.getInputSchema(),
        }
    }

    /**
     * 返回成功结果
     */
    protected success(output: string, extra?: Record<string, any>): ToolResult {
        return { success: true, output, ...extra }
    }

    /**
     * 返回错误结果
     */
    protected error(message: string): ToolResult {
        return { success: false, error: message }
    }
}

/**
 * 工具注册表
 */
export class ToolRegistry {
    private tools: Map<string, BaseTool> = new Map()

    /**
     * 注册工具
     */
    register(tool: BaseTool): void {
        this.tools.set(tool.name, tool)
    }

    /**
     * 获取工具
     */
    get(name: string): BaseTool | undefined {
        return this.tools.get(name)
    }

    /**
     * 获取所有工具
     */
    getAll(): BaseTool[] {
        return Array.from(this.tools.values())
    }

    /**
     * 获取所有工具定义
     */
    getDefinitions(): ToolDefinition[] {
        return this.getAll().map((tool) => tool.getDefinition())
    }

    /**
     * 执行工具
     */
    async execute(name: string, input: unknown): Promise<ToolResult> {
        const tool = this.get(name)
        if (!tool) {
            return { success: false, error: `Tool '${name}' not found` }
        }

        try {
            return await tool.execute(input)
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return { success: false, error: message }
        }
    }
}

/**
 * 全局工具注册表
 */
export const toolRegistry = new ToolRegistry()
