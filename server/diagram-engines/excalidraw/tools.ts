import { z } from "zod"
import { buildMermaidImgUrl } from "@/shared/script-convertor"

/**
 * Excalidraw tool definitions (client-rendered; no server execution).
 * Names are distinct from Draw.io to avoid XML expectations.
 */
export function getExcalidrawTools() {
    return {
        display_excalidraw: {
            description:
                "Render a full Excalidraw scene. Send elements array (required) plus optional appState/files.",
            inputSchema: z.object({
                elements: z.array(z.any()).describe("Excalidraw elements array"),
                appState: z
                    .record(z.string(), z.any())
                    .optional()
                    .describe("Optional appState (theme, viewBackgroundColor, gridSize, etc.)"),
                files: z
                    .record(z.string(), z.any())
                    .optional()
                    .describe("Optional files map for embedded images"),
            }),
        },
        edit_excalidraw: {
            description:
                "Patch the current Excalidraw scene. Use replace_elements or delete_elements to target specific ids.",
            inputSchema: z.object({
                operations: z.array(
                    z.object({
                        operation: z.enum([
                            "replace_elements",
                            "patch_elements",
                            "delete_elements",
                        ]),
                        elements: z
                            .array(z.any())
                            .optional()
                            .describe(
                                "Elements to add/replace or partial fields when patching",
                            ),
                        ids: z
                            .array(z.string())
                            .optional()
                            .describe("Ids to delete or patch"),
                    }),
                ),
            }),
        },
        append_excalidraw: {
            description:
                "Continue generation when the previous display_excalidraw response was truncated. Only send missing elements.",
            inputSchema: z.object({
                elements: z
                    .array(z.any())
                    .describe("Additional elements to append to the current payload"),
            }),
        },
        convert_mermaid_to_excalidraw: {
            description: `Convert Mermaid code to Excalidraw elements.

When autoInsert=true (default): Converts and inserts directly into canvas.
When autoInsert=false: Returns elements for AI to review/enhance before calling edit_excalidraw.

Supported Mermaid diagram types:
- flowchart / graph: Flowcharts (graph TD, graph LR)
- sequenceDiagram: Sequence diagrams
- classDiagram: Class diagrams
- stateDiagram / stateDiagram-v2: State diagrams
- erDiagram: Entity-Relationship diagrams
- gantt: Gantt charts
- pie: Pie charts
- mindmap: Mind maps

Use autoInsert=false for complex requests that need:
- Layout adjustments
- Style customization
- Element modifications before insertion`,
            inputSchema: z.object({
                code: z.string().describe("Mermaid DSL code to convert"),
                autoInsert: z
                    .boolean()
                    .optional()
                    .default(true)
                    .describe(
                        "If true (default), insert directly into canvas. If false, return elements for AI to review/enhance before calling edit_excalidraw.",
                    ),
            }),
            // 注意：@excalidraw/mermaid-to-excalidraw 依赖浏览器 API (DOMPurify 等)
            // 不能在服务端执行，转换在客户端进行
            // 服务端只生成图片下载 URL
            execute: async ({ code, autoInsert = true }: { code: string; autoInsert?: boolean }) => {
                console.log("[Mermaid Tool Execute] 服务端只生成 URL，转换在客户端进行")
                
                // 生成图片下载链接 (仅 URL 编码，不需要 DOM)
                let pngUrl = ""
                let svgUrl = ""
                
                try {
                    pngUrl = await buildMermaidImgUrl(code, { format: "png" })
                    svgUrl = await buildMermaidImgUrl(code, { format: "svg" })
                    console.log("[Mermaid Tool Execute] Generated URLs:", { pngUrl, svgUrl })
                } catch (urlError) {
                    console.error("[Mermaid Tool Execute] Failed to generate download URLs:", urlError)
                }
                
                // 返回代码和 URL，客户端负责转换
                return {
                    code,
                    pngUrl,
                    svgUrl,
                    autoInsert,
                    // 不返回 elements，客户端会检测到并自行转换
                    message: "Code received. Client will convert to Excalidraw elements.",
                }
            },
        },
    }
}
