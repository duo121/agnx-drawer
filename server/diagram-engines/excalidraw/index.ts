import type { DiagramEngine } from "../types"
import { getExcalidrawSystemPrompt } from "./system-prompt"
import { getExcalidrawTools } from "./tools"
import { mergeWithSharedTools } from "../shared-tools"

export const ExcalidrawEngine: DiagramEngine = {
    id: "excalidraw",
    name: "Excalidraw",
    dataFormat: "json",
    getSystemPrompt: (modelId?: string, minimalStyle?: boolean, canvasTheme?: string) =>
        getExcalidrawSystemPrompt(modelId, minimalStyle, canvasTheme),
    getTools: () => mergeWithSharedTools(getExcalidrawTools()),
    supportedExports: ["json", "png", "svg"],
}
