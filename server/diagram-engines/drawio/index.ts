import { getSystemPrompt } from "./system-prompt"
import type { DiagramEngine } from "../types"
import { getDrawioTools } from "./tools"
import { mergeWithSharedTools } from "../shared-tools"

export const DrawioEngine: DiagramEngine = {
    id: "drawio",
    name: "Draw.io",
    dataFormat: "xml",
    getSystemPrompt: (modelId?: string, minimalStyle?: boolean, canvasTheme?: string) =>
        getSystemPrompt(modelId, minimalStyle),
    getTools: () => mergeWithSharedTools(getDrawioTools(), "drawio"),
    supportedExports: ["drawio", "svg", "png"],
}
