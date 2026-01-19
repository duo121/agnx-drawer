/**
 * Shared tools available to all diagram engines
 * 
 * 使用 BaseTool 统一管理所有共享工具
 */

import { readTool, writeTool, switchCanvasTool, bashTool } from "@/server/tools"

/**
 * 获取所有共享工具的定义
 * 返回格式符合 AI SDK 的 tool 定义规范
 */
export function getSharedTools(): Record<string, any> {
    return {
        // 文件读取工具
        [readTool.name]: {
            description: readTool.description,
            inputSchema: readTool.getInputSchema(),
            execute: readTool.execute.bind(readTool),
        },
        // 文件写入工具
        [writeTool.name]: {
            description: writeTool.description,
            inputSchema: writeTool.getInputSchema(),
            execute: writeTool.execute.bind(writeTool),
        },
        // Bash 执行工具
        [bashTool.name]: {
            description: bashTool.description,
            inputSchema: bashTool.getInputSchema(),
            execute: bashTool.execute.bind(bashTool),
        },
        // 画布切换工具（客户端工具）
        [switchCanvasTool.name]: {
            description: switchCanvasTool.description,
            inputSchema: switchCanvasTool.getInputSchema(),
            execute: switchCanvasTool.execute.bind(switchCanvasTool),
        },
    }
}

/**
 * 获取共享工具实例列表（用于需要直接访问工具实例的场景）
 */
export function getSharedToolInstances() {
    return {
        readTool,
        writeTool,
        bashTool,
        switchCanvasTool,
    }
}

/**
 * Merge shared tools with engine-specific tools
 */
export function mergeWithSharedTools(engineTools: Record<string, any>): Record<string, any> {
    return {
        ...getSharedTools(),
        ...engineTools,
    }
}
