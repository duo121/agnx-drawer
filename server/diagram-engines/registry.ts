import { DrawioEngine } from "./drawio"
import { ExcalidrawEngine } from "./excalidraw"
import type { DiagramEngine } from "./types"
import { getSharedToolsWithoutEngineRestriction } from "./shared-tools"
import { getDrawioTools } from "./drawio/tools"
import { getExcalidrawTools } from "./excalidraw/tools"

const engines = new Map<string, DiagramEngine>([
    ["drawio", DrawioEngine],
    ["excalidraw", ExcalidrawEngine],
])

export function getEngine(engineId: string = "drawio"): DiagramEngine {
    return engines.get(engineId) ?? DrawioEngine
}

export function getAllEngines(): DiagramEngine[] {
    return Array.from(engines.values())
}

/**
 * 获取所有引擎的工具合集（用于双引擎会话）
 * 
 * 重要：双引擎模式下，shared tools（特别是 read_file）不应该有引擎限制，
 * 因为 AI 在同一会话中可能需要读取任意引擎的文档。
 * 引擎限制只适用于单引擎模式。
 */
export function getAllEngineTools(): Record<string, any> {
    // 获取不带引擎限制的 shared tools
    const sharedTools = getSharedToolsWithoutEngineRestriction()
    
    // 获取各引擎专用的工具（不包含 shared tools）
    const drawioTools = getDrawioTools()
    const excalidrawTools = getExcalidrawTools()
    
    return {
        ...sharedTools,
        ...drawioTools,
        ...excalidrawTools,
    }
}
