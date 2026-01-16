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
