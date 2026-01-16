import type React from "react"

export type ExportFormat = string

export interface EngineContext {
    ref?: React.RefObject<any>
    state?: any
    setState?: (state: any) => void
    [key: string]: any
}

export interface EditorProps {
    darkMode: boolean
    onStateChange?: (state: string) => void
}

export interface DiagramEngine {
    id: string
    name: string
    dataFormat: "xml" | "json" | "dsl"
    getSystemPrompt: (modelId?: string, minimalStyle?: boolean, canvasTheme?: string) => string
    getTools: () => Record<string, any>
    EditorComponent?: React.ComponentType<EditorProps>
    handleToolCall?: (
        toolCall: any,
        context: EngineContext,
    ) => Promise<void | any>
    supportedExports?: ExportFormat[]
    export?: (format: ExportFormat, context: EngineContext) => Promise<any>
    getCurrentState?: (context: EngineContext) => string
    loadState?: (state: string, context: EngineContext) => void
}
