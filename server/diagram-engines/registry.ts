import { DrawioEngine } from "./drawio"
import { ExcalidrawEngine } from "./excalidraw"
import type { DiagramEngine } from "./types"

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
 * 注意：shared tools 已经包含在每个引擎的 getTools 中，所以不会重复
 */
export function getAllEngineTools(): Record<string, any> {
    const allTools: Record<string, any> = {}
    for (const engine of engines.values()) {
        Object.assign(allTools, engine.getTools())
    }
    return allTools
}
