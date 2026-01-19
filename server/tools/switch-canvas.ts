/**
 * Switch Canvas Tool
 * 客户端工具 - 用于在 Draw.io 和 Excalidraw 之间切换画布
 */

import { z } from "zod"
import { BaseTool, type ToolResult } from "./base"

/**
 * Switch Canvas 输入 Schema
 */
const SwitchCanvasInputSchema = z.object({
    target: z
        .enum(["drawio", "excalidraw"])
        .describe("Target canvas engine to switch to"),
    reason: z
        .string()
        .describe("Brief explanation of why switching is needed (shown to user)"),
})

type SwitchCanvasInput = z.infer<typeof SwitchCanvasInputSchema>

/**
 * Switch Canvas 工具
 * 
 * 这是一个客户端工具 - 实际的画布切换在前端处理
 * 服务端只返回确认信息，前端根据工具调用结果触发画布切换
 */
export class SwitchCanvasTool extends BaseTool<SwitchCanvasInput, ToolResult> {
    name = "switch_canvas"
    
    description = `Switch to a different canvas engine. Use this when:
1. User explicitly requests a specific canvas (e.g., "use Excalidraw", "switch to Draw.io")
2. The requested diagram type requires a specific engine (PlantUML → Draw.io, Mermaid → Excalidraw)
3. User wants hand-drawn style (→ Excalidraw) or professional diagrams with icons (→ Draw.io)

Available engines:
- drawio: Professional diagrams, rich icon libraries (AWS, Azure, GCP, K8s), PlantUML support
- excalidraw: Hand-drawn style, Mermaid support, whiteboard feel

After calling this tool, wait for the canvas to switch before generating diagram content.`

    /**
     * 标记为客户端工具
     */
    readonly isClientSide = true

    getInputSchema() {
        return SwitchCanvasInputSchema
    }

    /**
     * 客户端工具的 execute 只返回确认信息
     * 实际的画布切换由前端处理
     */
    async execute(input: SwitchCanvasInput): Promise<ToolResult> {
        return this.success(`Switching to ${input.target} canvas`, {
            target: input.target,
            reason: input.reason,
            // 标记需要前端处理
            requiresClientAction: true,
        })
    }
}

/**
 * 创建 Switch Canvas 工具实例
 */
export const switchCanvasTool = new SwitchCanvasTool()
