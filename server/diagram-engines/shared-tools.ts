/**
 * Shared tools available to all diagram engines
 * 
 * 使用 BaseTool 统一管理所有共享工具
 */

import { readTool, writeTool, switchCanvasTool, bashTool } from "@/server/tools"

// 引擎 ID 类型
type EngineId = "drawio" | "excalidraw"

// 引擎对应的 skills 目录路径
const ENGINE_SKILL_PATHS: Record<EngineId, string> = {
    drawio: "skills/drawio",
    excalidraw: "skills/excalidraw",
}

/**
 * 创建带引擎限制的 read_file 工具
 * 禁止跨引擎读取 skills 目录
 */
function createEngineAwareReadTool(currentEngine: EngineId) {
    const otherEngine: EngineId = currentEngine === "drawio" ? "excalidraw" : "drawio"
    const forbiddenPath = ENGINE_SKILL_PATHS[otherEngine]
    
    return {
        description: readTool.description,
        inputSchema: readTool.getInputSchema(),
        execute: async (input: { file_path: string; offset?: number; limit?: number }) => {
            const { file_path } = input
            
            // 检查是否试图读取其他引擎的 skills 目录
            if (file_path.includes(forbiddenPath)) {
                return {
                    success: false,
                    error: `Cannot read ${forbiddenPath}/* - you are currently on ${currentEngine} engine. ` +
                           `Use the ${currentEngine} icon system instead. ` +
                           (currentEngine === "excalidraw" 
                               ? `For icons, use $icon placeholder syntax like {"$icon": "aws/lambda", "x": 100, "y": 200}. See SKILL.md Icon Library section.`
                               : `For icons, read skills/drawio/shape-libraries/*.md for correct syntax.`),
                }
            }
            
            // 正常执行
            return readTool.execute(input)
        },
    }
}

/**
 * 获取所有共享工具的定义
 * 返回格式符合 AI SDK 的 tool 定义规范
 * @param currentEngine 当前活跃的引擎 ID
 */
export function getSharedTools(currentEngine?: EngineId): Record<string, any> {
    // 如果提供了引擎 ID，使用带限制的 read_file
    const readFileTool = currentEngine 
        ? createEngineAwareReadTool(currentEngine)
        : {
            description: readTool.description,
            inputSchema: readTool.getInputSchema(),
            execute: readTool.execute.bind(readTool),
        }
    
    return {
        // 文件读取工具（带引擎限制）
        [readTool.name]: readFileTool,
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
 * 获取不带引擎限制的共享工具（用于双引擎会话）
 * 
 * 在双引擎模式下，AI 需要能够读取任意引擎的文档，
 * 所以 read_file 不应该有跨引擎限制。
 */
export function getSharedToolsWithoutEngineRestriction(): Record<string, any> {
    return {
        // 文件读取工具（无引擎限制）
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
 * @param engineTools 引擎特有的工具
 * @param engineId 当前引擎 ID，用于限制跨引擎访问
 */
export function mergeWithSharedTools(engineTools: Record<string, any>, engineId?: EngineId): Record<string, any> {
    return {
        ...getSharedTools(engineId),
        ...engineTools,
    }
}
