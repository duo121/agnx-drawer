import type { MutableRefObject } from "react"
import { isMxCellXmlComplete, wrapWithMxFile } from "@/shared/utils"
import {
    convertPlantUMLToDrawio,
    encodePlantUML,
} from "@/shared/script-convertor"
import { resolveIconPlaceholders, hasIconPlaceholders } from "@/shared/excalidraw-icon-resolver"

const DEBUG = process.env.NODE_ENV === "development"

interface ToolCall {
    toolCallId: string
    toolName: string
    input: unknown
}

type AddToolOutputSuccess = {
    tool: string
    toolCallId: string
    state?: "output-available"
    output: any
    errorText?: undefined
}

type AddToolOutputError = {
    tool: string
    toolCallId: string
    state: "output-error"
    output?: undefined
    errorText: string
}

type AddToolOutputParams = AddToolOutputSuccess | AddToolOutputError

type AddToolOutputFn = (params: AddToolOutputParams) => void

interface DiagramOperation {
    operation: "update" | "add" | "delete"
    cell_id: string
    new_xml?: string
}

interface UseDiagramToolHandlersParams {
    partialXmlRef: MutableRefObject<string>
    editDiagramOriginalXmlRef: MutableRefObject<Map<string, string>>
    chartXMLRef: MutableRefObject<string>
    onDisplayChart: (xml: string, skipValidation?: boolean) => string | null
    onFetchChart: (saveToHistory?: boolean) => Promise<string>
    onExport: () => Promise<string | null>
    onSelectCells?: (ids?: string[]) => void
    getExcalidrawScene?: () => any
    setExcalidrawScene?: (scene: any) => Promise<void>
    appendExcalidrawElements?: (
        elements: any[],
        options?: { selectIds?: string[] },
    ) => Promise<{ newIds: string[] }>
    editExcalidrawByOperations?: (
        operations: any[],
    ) => Promise<{ newIds: string[] }>
    selectExcalidrawElements?: (ids?: string[]) => void
    // Excalidraw 历史记录
    pushExcalidrawHistory?: (label?: string) => Promise<void>
    // 画板切换 - 返回 Promise，在新画板就绪后 resolve
    onSwitchCanvas?: (targetEngine: "drawio" | "excalidraw", reason?: string) => Promise<void>
    /** 获取当前引擎 ID */
    getCurrentEngineId?: () => "drawio" | "excalidraw"
    /** 获取当前画布缩略图（用于工具卡片预览） */
    getThumbnailSvg?: () => Promise<string | null>
    /** 获取 DrawIO 的最新 SVG（同步读取，不触发导出） */
    getLatestSvg?: () => string
}

/**
 * 确保 Excalidraw 元素有效
 * 注意：必须保留所有原有属性，包括 text、containerId、boundElements 等
 */
const ensureExcalidrawElements = (elements: any[] = []) => {
    const toNumber = (val: any, fallback: number) =>
        typeof val === "number" && Number.isFinite(val) ? val : fallback
    return elements
        .filter((el) => el && typeof el === "object")
        .map((el) => {
            // 复制原始元素，保留所有属性
            const result = { ...el }
            
            // 只填充缺失的必要字段，不覆盖已有值
            if (result.version === undefined) result.version = 1
            if (result.versionNonce === undefined) {
                result.versionNonce = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
            }
            if (result.updated === undefined) result.updated = Date.now()
            
            // 数值字段：确保是有效数字
            result.x = toNumber(result.x, 0)
            result.y = toNumber(result.y, 0)
            result.width = toNumber(result.width, 100)
            result.height = toNumber(result.height, 60)
            result.angle = toNumber(result.angle, 0)
            result.strokeWidth = toNumber(result.strokeWidth, 2)
            result.roughness = toNumber(result.roughness, 0)
            result.opacity = toNumber(result.opacity, 100)
            
            // 确保 groupIds 是数组
            if (!Array.isArray(result.groupIds)) result.groupIds = []
            // boundElements 可以是数组或 null
            if (result.boundElements !== null && !Array.isArray(result.boundElements)) {
                result.boundElements = []
            }
            
            return result
        })
}

/**
 * Hook that creates the onToolCall handler for diagram-related tools.
 * Handles display_drawio, edit_drawio, append_drawio, and Excalidraw tools.
 *
 * Note: addToolOutput is passed at call time (not hook init) because
 * it comes from useChat which creates a circular dependency.
 */
export function useDiagramToolHandlers({
    partialXmlRef,
    editDiagramOriginalXmlRef,
    chartXMLRef,
    onDisplayChart,
    onFetchChart,
    onExport,
    onSelectCells,
    getExcalidrawScene,
    setExcalidrawScene,
    appendExcalidrawElements,
    editExcalidrawByOperations,
    selectExcalidrawElements,
    pushExcalidrawHistory,
    onSwitchCanvas,
    getCurrentEngineId,
    getThumbnailSvg,
    getLatestSvg,
}: UseDiagramToolHandlersParams) {
    /**
     * 确保当前引擎与工具所需引擎匹配
     * 如果不匹配，自动切换引擎并等待就绪
     * @param requiredEngine 工具所需的引擎类型
     * @returns 如果切换成功或已经是正确引擎，返回 true；如果切换失败，返回 false
     */
    const ensureCorrectEngine = async (requiredEngine: "drawio" | "excalidraw"): Promise<boolean> => {
        if (!getCurrentEngineId || !onSwitchCanvas) {
            // 无法检测/切换，假设引擎正确
            return true
        }
        
        const currentEngine = getCurrentEngineId()
        if (currentEngine === requiredEngine) {
            // 已经是正确引擎
            return true
        }
        
        try {
            console.log(`[ensureCorrectEngine] Auto-switching from ${currentEngine} to ${requiredEngine}`)
            await onSwitchCanvas(requiredEngine, `Tool requires ${requiredEngine} engine`)
            return true
        } catch (error) {
            console.error(`[ensureCorrectEngine] Failed to switch to ${requiredEngine}:`, error)
            return false
        }
    }
    const handleToolCall = async (
        { toolCall }: { toolCall: ToolCall },
        addToolOutput: AddToolOutputFn,
    ) => {
        console.log(
            `[onToolCall] 收到工具调用: ${toolCall.toolName}, CallId: ${toolCall.toolCallId}`,
        )
        console.log(`[onToolCall] Tool call 完整数据:`, JSON.stringify(toolCall, null, 2))

        // DrawIO tools - 自动切换引擎
        if (toolCall.toolName === "display_drawio") {
            if (!await ensureCorrectEngine("drawio")) {
                addToolOutput({
                    tool: toolCall.toolName,
                    toolCallId: toolCall.toolCallId,
                    state: "output-error",
                    errorText: "Failed to switch to DrawIO engine. Please try again.",
                })
                return
            }
            await handleDisplayDrawio(toolCall, addToolOutput)
        } else if (toolCall.toolName === "edit_drawio") {
            if (!await ensureCorrectEngine("drawio")) {
                addToolOutput({
                    tool: toolCall.toolName,
                    toolCallId: toolCall.toolCallId,
                    state: "output-error",
                    errorText: "Failed to switch to DrawIO engine. Please try again.",
                })
                return
            }
            await handleEditDrawio(toolCall, addToolOutput)
        } else if (toolCall.toolName === "append_drawio") {
            if (!await ensureCorrectEngine("drawio")) {
                addToolOutput({
                    tool: toolCall.toolName,
                    toolCallId: toolCall.toolCallId,
                    state: "output-error",
                    errorText: "Failed to switch to DrawIO engine. Please try again.",
                })
                return
            }
            await handleAppendDrawio(toolCall, addToolOutput)
        } else if (toolCall.toolName === "convert_plantuml_to_drawio") {
            if (!await ensureCorrectEngine("drawio")) {
                addToolOutput({
                    tool: toolCall.toolName,
                    toolCallId: toolCall.toolCallId,
                    state: "output-error",
                    errorText: "Failed to switch to DrawIO engine. Please try again.",
                })
                return
            }
            await handlePlantUML(toolCall, addToolOutput)
        // Excalidraw tools - 自动切换引擎
        } else if (toolCall.toolName === "display_excalidraw") {
            if (!await ensureCorrectEngine("excalidraw")) {
                addToolOutput({
                    tool: toolCall.toolName,
                    toolCallId: toolCall.toolCallId,
                    state: "output-error",
                    errorText: "Failed to switch to Excalidraw engine. Please try again.",
                })
                return
            }
            await handleDisplayExcalidraw(toolCall, addToolOutput)
        } else if (toolCall.toolName === "append_excalidraw") {
            if (!await ensureCorrectEngine("excalidraw")) {
                addToolOutput({
                    tool: toolCall.toolName,
                    toolCallId: toolCall.toolCallId,
                    state: "output-error",
                    errorText: "Failed to switch to Excalidraw engine. Please try again.",
                })
                return
            }
            await handleAppendExcalidraw(toolCall, addToolOutput)
        } else if (toolCall.toolName === "edit_excalidraw") {
            if (!await ensureCorrectEngine("excalidraw")) {
                addToolOutput({
                    tool: toolCall.toolName,
                    toolCallId: toolCall.toolCallId,
                    state: "output-error",
                    errorText: "Failed to switch to Excalidraw engine. Please try again.",
                })
                return
            }
            await handleEditExcalidraw(toolCall, addToolOutput)
        } else if (toolCall.toolName === "convert_mermaid_to_excalidraw") {
            if (!await ensureCorrectEngine("excalidraw")) {
                addToolOutput({
                    tool: toolCall.toolName,
                    toolCallId: toolCall.toolCallId,
                    state: "output-error",
                    errorText: "Failed to switch to Excalidraw engine. Please try again.",
                })
                return
            }
            console.log(`[onToolCall] 开始执行 handleMermaid`)
            await handleMermaid(toolCall, addToolOutput)
        // Shared tools
        } else if (toolCall.toolName === "switch_canvas") {
            await handleSwitchCanvas(toolCall, addToolOutput)
        } else {
            console.warn(`[onToolCall] 未知的工具名称: ${toolCall.toolName}`)
        }
    }

    const handleSwitchCanvas = async (
        toolCall: ToolCall,
        addToolOutput: AddToolOutputFn,
    ) => {
        const { target, reason } = toolCall.input as { target: "drawio" | "excalidraw"; reason?: string }

        if (!onSwitchCanvas) {
            addToolOutput({
                tool: "switch_canvas",
                toolCallId: toolCall.toolCallId,
                state: "output-error",
                errorText: "Canvas switching is not available in this context.",
            })
            return
        }

        try {
            // 等待画板切换完成并就绪
            await onSwitchCanvas(target, reason)
            addToolOutput({
                tool: "switch_canvas",
                toolCallId: toolCall.toolCallId,
                output: {
                    success: true,
                    targetEngine: target,
                    message: `Switched to ${target === "drawio" ? "Draw.io" : "Excalidraw"} canvas. Canvas is now ready.${reason ? ` Reason: ${reason}` : ""}`,
                },
            })
        } catch (error) {
            console.error("[switch_canvas] Failed:", error)
            addToolOutput({
                tool: "switch_canvas",
                toolCallId: toolCall.toolCallId,
                state: "output-error",
                errorText: `Failed to switch canvas: ${error instanceof Error ? error.message : String(error)}`,
            })
        }
    }

    const handleDisplayDrawio = async (
        toolCall: ToolCall,
        addToolOutput: AddToolOutputFn,
    ) => {
        const { xml } = toolCall.input as { xml: string }

        // DEBUG: Log raw input to diagnose false truncation detection
        if (DEBUG) {
            console.log(
                "[display_drawio] XML ending (last 100 chars):",
                xml.slice(-100),
            )
            console.log("[display_drawio] XML length:", xml.length)
        }

        // Check if XML is truncated (incomplete mxCell indicates truncated output)
        const isTruncated = !isMxCellXmlComplete(xml)
        if (DEBUG) {
            console.log("[display_drawio] isTruncated:", isTruncated)
        }

        if (isTruncated) {
            // Store the partial XML for continuation via append_drawio
            partialXmlRef.current = xml

            // Tell LLM to use append_drawio to continue
            const partialEnding = partialXmlRef.current.slice(-500)
            addToolOutput({
                tool: "display_drawio",
                toolCallId: toolCall.toolCallId,
                state: "output-error",
                errorText: `Output was truncated due to length limits. Use the append_drawio tool to continue.

Your output ended with:
\`\`\`
${partialEnding}
\`\`\`

NEXT STEP: Call append_drawio with the continuation XML.
- Do NOT include wrapper tags or root cells (id="0", id="1")
- Start from EXACTLY where you stopped
- Complete all remaining mxCell elements`,
            })
            return
        }

        // Complete XML received - use it directly
        // (continuation is now handled via append_drawio tool)
        const finalXml = xml
        partialXmlRef.current = "" // Reset any partial from previous truncation

        // Wrap raw XML with full mxfile structure for draw.io
        const fullXml = wrapWithMxFile(finalXml)

        // loadDiagram validates and returns error if invalid
        const validationError = onDisplayChart(fullXml)

        if (validationError) {
            console.warn("[display_drawio] Validation error:", validationError)
            // Return error to model - sendAutomaticallyWhen will trigger retry
            if (DEBUG) {
                console.log(
                    "[display_drawio] Adding tool output with state: output-error",
                )
            }
            addToolOutput({
                tool: "display_drawio",
                toolCallId: toolCall.toolCallId,
                state: "output-error",
                errorText: `${validationError}

Please fix the XML issues and call display_drawio again with corrected XML.

Your failed XML:
\`\`\`xml
${finalXml}
\`\`\``,
            })
        } else {
            // Success - diagram will be rendered by chat-message-display
            if (DEBUG) {
                console.log(
                    "[display_drawio] Success! Adding tool output with state: output-available",
                )
            }
            
            // 延迟等待图表渲染完成，然后导出并捕获缩略图
            await new Promise(resolve => setTimeout(resolve, 300))
            
            let thumbnailDataUrl: string | undefined
            try {
                console.log('[display_drawio] Exporting and capturing thumbnail')
                const svgData = await onExport()
                if (svgData) {
                    thumbnailDataUrl = svgData
                    console.log('[display_drawio] Captured thumbnail SVG')
                }
            } catch (err) {
                console.warn('[display_drawio] Failed to capture thumbnail:', err)
            }
            
            addToolOutput({
                tool: "display_drawio",
                toolCallId: toolCall.toolCallId,
                output: {
                    success: true,
                    message: "Successfully displayed the diagram.",
                    thumbnailDataUrl,
                },
            })
            
            if (DEBUG) {
                console.log(
                    "[display_drawio] Tool output added with thumbnail. Diagram should be visible now.",
                )
            }
        }
    }

    const handleMermaid = async (
        toolCall: ToolCall,
        addToolOutput: AddToolOutputFn,
    ) => {
        console.log("[handleMermaid] === 开始执行 ===")
        console.log("[handleMermaid] appendExcalidrawElements:", !!appendExcalidrawElements)
        
        // 优先使用服务端返回的结果
        const result = (toolCall as any).result || {}
        let elements = result.elements
        let files = result.files
        let pngUrl = result.pngUrl as string | undefined
        let svgUrl = result.svgUrl as string | undefined
        const code = result.code || (toolCall.input as any)?.code
        // Get autoInsert from result (server) or input (client fallback), default to true
        const autoInsert = result.autoInsert ?? (toolCall.input as any)?.autoInsert ?? true
        
        if (DEBUG) {
            console.log("[handleMermaid] Tool call data:", {
                hasResult: !!result,
                resultKeys: Object.keys(result),
                elementsCount: Array.isArray(elements) ? elements.length : 0,
                hasFiles: !!files,
                hasPngUrl: !!pngUrl,
                hasSvgUrl: !!svgUrl,
                hasCode: !!code,
                autoInsert,
            })
        }
        
        if (!code) {
            addToolOutput({
                tool: "convert_mermaid_to_excalidraw",
                toolCallId: toolCall.toolCallId,
                state: "output-error",
                errorText: "No Mermaid code provided",
            })
            return
        }

        try {
            // 服务端不执行转换（依赖浏览器 API），在客户端转换
            console.log("[handleMermaid] Converting Mermaid on client")
            const { convertMermaidToExcalidraw, buildMermaidImgUrl } = await import(
                "@/shared/script-convertor"
            )
            
            const conversionResult = await convertMermaidToExcalidraw(code, {
                isDark: false, // TODO: 从主题中获取
            })
            
            elements = conversionResult.elements || []
            files = conversionResult.files
            
            // 使用服务端返回的 URL，如果没有则生成
            if (!pngUrl) {
                pngUrl = await buildMermaidImgUrl(code, { format: "png" })
            }
            if (!svgUrl) {
                svgUrl = await buildMermaidImgUrl(code, { format: "svg" })
            }
            
            if (!Array.isArray(elements) || elements.length === 0) {
                addToolOutput({
                    tool: "convert_mermaid_to_excalidraw",
                    toolCallId: toolCall.toolCallId,
                    state: "output-error",
                    errorText:
                        "Failed to convert Mermaid: No elements generated. Please check the Mermaid syntax.",
                })
                return
            }
            
            if (DEBUG) {
                console.log("[handleMermaid] URLs:", { pngUrl, svgUrl })
            }

            // 验证和清理元素
            const safeElements = ensureExcalidrawElements(elements)

            // If autoInsert is false, return elements without inserting
            if (!autoInsert) {
                if (DEBUG) {
                    console.log("[handleMermaid] autoInsert=false, returning elements without inserting")
                }
                addToolOutput({
                    tool: "convert_mermaid_to_excalidraw",
                    toolCallId: toolCall.toolCallId,
                    output: {
                        code,
                        elements: safeElements,
                        files,
                        pngUrl,
                        svgUrl,
                        autoInsert: false,
                        message: "Conversion complete. Review the elements and call edit_excalidraw to insert with modifications.",
                    },
                })
                return
            }

            // autoInsert=true: insert into canvas
            if (!appendExcalidrawElements) {
                console.error("[handleMermaid] Excalidraw renderer 不可用")
                addToolOutput({
                    tool: "convert_mermaid_to_excalidraw",
                    toolCallId: toolCall.toolCallId,
                    state: "output-error",
                    errorText:
                        "Excalidraw renderer is not ready. Please try again later.",
                })
                return
            }

            // 追加元素到画布并选中（会自动生成新ID并选中）
            const appendResult = await appendExcalidrawElements(safeElements)

            if (DEBUG) {
                console.log(
                    `[handleMermaid] Appended ${appendResult.newIds?.length || safeElements.length} elements`,
                )
            }

            // 保存简单对象（不含大数组），支持重新插入
            const outputData = {
                code,  // Mermaid 代码，用于重新转换
                elementsCount: safeElements.length,
                autoInsert: true,
                message: `Successfully converted and inserted Mermaid diagram with ${safeElements.length} element(s).`,
            }
            
            console.log("[handleMermaid] 调用 addToolOutput:", {
                elementsCount: safeElements.length,
                hasCode: !!code,
            })
            
            addToolOutput({
                tool: "convert_mermaid_to_excalidraw",
                toolCallId: toolCall.toolCallId,
                output: outputData,
            })
        } catch (error) {
            console.error("[handleMermaid] Failed to convert Mermaid:", error)
            addToolOutput({
                tool: "convert_mermaid_to_excalidraw",
                toolCallId: toolCall.toolCallId,
                state: "output-error",
                errorText: `Failed to convert Mermaid: ${error instanceof Error ? error.message : String(error)}`,
            })
        }
    }

    const handlePlantUML = async (
        toolCall: ToolCall,
        addToolOutput: AddToolOutputFn,
    ) => {
        // Server-side execute may return result; fallback to client conversion if missing
        const result = (toolCall as any).result || {}
        let xml = result.xml || (toolCall.input as any)?.xml
        
        // DEBUG: 追踪 XML 来源
        console.log('[handlePlantUML] XML source:', {
            hasResultXml: !!result.xml,
            hasInputXml: !!(toolCall.input as any)?.xml,
            xmlLength: xml?.length || 0,
            xmlPreview: xml?.substring(0, 500) || 'none'
        })
        let pngUrl = result.pngUrl as string | undefined
        let svgUrl = result.svgUrl as string | undefined
        const code =
            (result.code as string | undefined) ||
            (toolCall.input as any)?.code ||
            (toolCall.input as any)?.text
        // Get autoInsert from result (server) or input (client fallback), default to true
        const autoInsert = result.autoInsert ?? (toolCall.input as any)?.autoInsert ?? true

        // If server did not return xml or download URLs, compute client-side
        if ((!xml || !pngUrl || !svgUrl) && code) {
            try {
                if (!xml) {
                    xml = await convertPlantUMLToDrawio(code)
                }
                if (!pngUrl) {
                    pngUrl = await encodePlantUML(code, { format: "png" })
                }
                if (!svgUrl) {
                    svgUrl = await encodePlantUML(code, { format: "svg" })
                }
            } catch (err) {
                console.warn("[convert_plantuml_to_drawio] client fallback failed:", err)
            }
        }

        if (!xml) {
            addToolOutput({
                tool: "convert_plantuml_to_drawio",
                toolCallId: toolCall.toolCallId,
                state: "output-error",
                errorText: "No XML returned from PlantUML conversion",
            })
            return
        }

        // If autoInsert is false, return XML without inserting
        if (!autoInsert) {
            if (DEBUG) {
                console.log("[convert_plantuml_to_drawio] autoInsert=false, returning XML without inserting")
            }
            addToolOutput({
                tool: "convert_plantuml_to_drawio",
                toolCallId: toolCall.toolCallId,
                output: {
                    code,
                    pngUrl,
                    svgUrl,
                    xml,
                    autoInsert: false,
                    message: "Conversion complete. Review the XML and call edit_drawio to insert with modifications.",
                },
            })
            return
        }

        // autoInsert=true: insert into canvas
        const validationError = onDisplayChart(xml, true)
        if (validationError) {
            addToolOutput({
                tool: "convert_plantuml_to_drawio",
                toolCallId: toolCall.toolCallId,
                state: "output-error",
                errorText: validationError,
            })
            return
        }
        const insertedIds = result.insertedIds as string[] | undefined
        onSelectCells?.(insertedIds ?? [])
        addToolOutput({
            tool: "convert_plantuml_to_drawio",
            toolCallId: toolCall.toolCallId,
            output: {
                code,
                pngUrl,
                svgUrl,
                xml,
                autoInsert: true,
                message: "Inserted PlantUML diagram.",
            },
        })
    }

    const handleEditDrawio = async (
        toolCall: ToolCall,
        addToolOutput: AddToolOutputFn,
    ) => {
        const { operations } = toolCall.input as {
            operations: DiagramOperation[]
        }

        let currentXml = ""
        try {
            // Use the original XML captured during streaming (shared with chat-message-display)
            // This ensures we apply operations to the same base XML that streaming used
            const originalXml = editDiagramOriginalXmlRef.current.get(
                toolCall.toolCallId,
            )
            if (originalXml) {
                currentXml = originalXml
            } else {
                // Fallback: use chartXML from ref if streaming didn't capture original
                const cachedXML = chartXMLRef.current
                if (cachedXML) {
                    currentXml = cachedXML
                } else {
                    // Last resort: export from iframe
                    currentXml = await onFetchChart(false)
                }
            }

            const { applyDiagramOperations } = await import("@/shared/utils")
            const { result: editedXml, errors } = applyDiagramOperations(
                currentXml,
                operations,
            )

            // Check for operation errors
            if (errors.length > 0) {
                const errorMessages = errors
                    .map(
                        (e) =>
                            `- ${e.type} on cell_id="${e.cellId}": ${e.message}`,
                    )
                    .join("\n")

                addToolOutput({
                    tool: "edit_drawio",
                    toolCallId: toolCall.toolCallId,
                    state: "output-error",
                    errorText: `Some operations failed:\n${errorMessages}

Current diagram XML:
\`\`\`xml
${currentXml}
\`\`\`

Please check the cell IDs and retry.`,
                })
                // Clean up the shared original XML ref
                editDiagramOriginalXmlRef.current.delete(toolCall.toolCallId)
                return
            }

            // loadDiagram validates and returns error if invalid
            const validationError = onDisplayChart(editedXml)
            if (validationError) {
                console.warn(
                    "[edit_drawio] Validation error:",
                    validationError,
                )
                addToolOutput({
                    tool: "edit_drawio",
                    toolCallId: toolCall.toolCallId,
                    state: "output-error",
                    errorText: `Edit produced invalid XML: ${validationError}

Current diagram XML:
\`\`\`xml
${currentXml}
\`\`\`

Please fix the operations to avoid structural issues.`,
                })
                // Clean up the shared original XML ref
                editDiagramOriginalXmlRef.current.delete(toolCall.toolCallId)
                return
            }
            // 延迟等待图表渲染完成，然后导出并捕获缩略图
            await new Promise(resolve => setTimeout(resolve, 300))
            
            let thumbnailDataUrl: string | undefined
            try {
                console.log('[edit_drawio] Exporting and capturing thumbnail')
                const svgData = await onExport()
                if (svgData) {
                    thumbnailDataUrl = svgData
                    console.log('[edit_drawio] Captured thumbnail SVG')
                }
            } catch (err) {
                console.warn('[edit_drawio] Failed to capture thumbnail:', err)
            }
            
            addToolOutput({
                tool: "edit_drawio",
                toolCallId: toolCall.toolCallId,
                output: {
                    success: true,
                    message: `Successfully applied ${operations.length} operation(s) to the diagram.`,
                    thumbnailDataUrl,
                },
            })
            // Clean up the shared original XML ref
            editDiagramOriginalXmlRef.current.delete(toolCall.toolCallId)
        } catch (error) {
            console.error("[edit_drawio] Failed:", error)

            const errorMessage =
                error instanceof Error ? error.message : String(error)

            addToolOutput({
                tool: "edit_drawio",
                toolCallId: toolCall.toolCallId,
                state: "output-error",
                errorText: `Edit failed: ${errorMessage}

Current diagram XML:
\`\`\`xml
${currentXml || "No XML available"}
\`\`\`

Please check cell IDs and retry, or use display_drawio to regenerate.`,
            })
            // Clean up the shared original XML ref even on error
            editDiagramOriginalXmlRef.current.delete(toolCall.toolCallId)
        }
    }

    const handleDisplayExcalidraw = async (
        toolCall: ToolCall,
        addToolOutput: AddToolOutputFn,
    ) => {
        if (!setExcalidrawScene) {
            addToolOutput({
                tool: toolCall.toolName,
                toolCallId: toolCall.toolCallId,
                state: "output-error",
                errorText:
                    "Excalidraw renderer is not ready. Please try again later.",
            })
            return
        }

        const { elements = [], appState, files } = toolCall.input as any
        
        // Resolve $icon placeholders if present
        let resolvedElements = elements || []
        if (hasIconPlaceholders(resolvedElements)) {
            console.log(`[handleDisplayExcalidraw] Resolving ${resolvedElements.filter((e: any) => e?.$icon).length} icon placeholders`)
            resolvedElements = await resolveIconPlaceholders(resolvedElements)
        }
        
        const safeElements = ensureExcalidrawElements(resolvedElements)
        await setExcalidrawScene({
            elements: safeElements,
            appState,
            files: safeElements.length === 0 ? {} : files,
        })
        if (selectExcalidrawElements) {
            const ids =
                Array.isArray(safeElements) && safeElements.length > 0
                    ? safeElements
                          .map((el: any) => el?.id)
                          .filter((id: any) => typeof id === "string")
                    : []
            selectExcalidrawElements(ids)
        }

        // 工具调用成功后保存历史版本
        if (pushExcalidrawHistory && safeElements.length > 0) {
            await pushExcalidrawHistory("AI 生成")
        }

        // 延迟捕获缩略图，确保图表已渲染
        let thumbnailDataUrl: string | undefined
        if (getThumbnailSvg && safeElements.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 300))
            try {
                const svg = await getThumbnailSvg()
                if (svg) {
                    thumbnailDataUrl = svg
                    console.log('[display_excalidraw] Captured thumbnail SVG')
                }
            } catch (err) {
                console.warn('[display_excalidraw] Failed to capture thumbnail:', err)
            }
        }

        addToolOutput({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output: {
                success: true,
                message: "Excalidraw scene displayed",
                thumbnailDataUrl,
            },
        })
    }

    const handleAppendExcalidraw = async (
        toolCall: ToolCall,
        addToolOutput: AddToolOutputFn,
    ) => {
        if (!appendExcalidrawElements) {
            addToolOutput({
                tool: toolCall.toolName,
                toolCallId: toolCall.toolCallId,
                state: "output-error",
                errorText:
                    "Excalidraw renderer is not ready. Please try again later.",
            })
            return
        }
        const { elements = [] } = toolCall.input as any
        const safeElements = ensureExcalidrawElements(elements || [])
        // 直接追加元素，会自动生成新ID并选中
        const res = await appendExcalidrawElements(safeElements)
        addToolOutput({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output: { newIds: res?.newIds || [] },
        })
    }

    const handleEditExcalidraw = async (
        toolCall: ToolCall,
        addToolOutput: AddToolOutputFn,
    ) => {
        if (!editExcalidrawByOperations) {
            addToolOutput({
                tool: toolCall.toolName,
                toolCallId: toolCall.toolCallId,
                state: "output-error",
                errorText:
                    "Excalidraw renderer is not ready. Please try again later.",
            })
            return
        }
        const operations = (toolCall.input as any)?.operations
        if (!Array.isArray(operations) || operations.length === 0) {
            addToolOutput({
                tool: toolCall.toolName,
                toolCallId: toolCall.toolCallId,
                state: "output-error",
                errorText: "Missing operations for edit_excalidraw",
            })
            return
        }

        const res = await editExcalidrawByOperations(operations)

        // 工具调用成功后保存历史版本
        if (pushExcalidrawHistory) {
            await pushExcalidrawHistory("AI 编辑")
        }

        addToolOutput({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output: { updatedIds: res?.newIds || [] },
        })
    }

    const handleAppendDrawio = async (
        toolCall: ToolCall,
        addToolOutput: AddToolOutputFn,
    ) => {
        const { xml } = toolCall.input as { xml: string }

        // Detect if LLM incorrectly started fresh instead of continuing
        // LLM should only output bare mxCells now, so wrapper tags indicate error
        const trimmed = xml.trim()
        const isFreshStart =
            trimmed.startsWith("<mxGraphModel") ||
            trimmed.startsWith("<root") ||
            trimmed.startsWith("<mxfile") ||
            trimmed.startsWith('<mxCell id="0"') ||
            trimmed.startsWith('<mxCell id="1"')

        if (isFreshStart) {
            addToolOutput({
                tool: "append_drawio",
                toolCallId: toolCall.toolCallId,
                state: "output-error",
                errorText: `ERROR: You started fresh with wrapper tags. Do NOT include wrapper tags or root cells (id="0", id="1").

Continue from EXACTLY where the partial ended:
\`\`\`
${partialXmlRef.current.slice(-500)}
\`\`\`

Start your continuation with the NEXT character after where it stopped.`,
            })
            return
        }

        // Append to accumulated XML
        partialXmlRef.current += xml

        // Check if XML is now complete (last mxCell is complete)
        const isComplete = isMxCellXmlComplete(partialXmlRef.current)

        if (isComplete) {
            // Wrap and display the complete diagram
            const finalXml = partialXmlRef.current
            partialXmlRef.current = "" // Reset

            const fullXml = wrapWithMxFile(finalXml)
            const validationError = onDisplayChart(fullXml)

            if (validationError) {
                addToolOutput({
                    tool: "append_drawio",
                    toolCallId: toolCall.toolCallId,
                    state: "output-error",
                    errorText: `Validation error after assembly: ${validationError}

Assembled XML:
\`\`\`xml
${finalXml.substring(0, 2000)}...
\`\`\`

Please use display_drawio with corrected XML.`,
                })
            } else {
                // 延迟等待图表渲染完成，然后导出并捕获缩略图
                await new Promise(resolve => setTimeout(resolve, 300))
                
                let thumbnailDataUrl: string | undefined
                try {
                    console.log('[append_drawio] Exporting and capturing thumbnail')
                    const svgData = await onExport()
                    if (svgData) {
                        thumbnailDataUrl = svgData
                        console.log('[append_drawio] Captured thumbnail SVG')
                    }
                } catch (err) {
                    console.warn('[append_drawio] Failed to capture thumbnail:', err)
                }
                
                addToolOutput({
                    tool: "append_drawio",
                    toolCallId: toolCall.toolCallId,
                    output: {
                        success: true,
                        message: "Diagram assembly complete and displayed successfully.",
                        thumbnailDataUrl,
                    },
                })
            }
        } else {
            // Still incomplete - signal to continue
            addToolOutput({
                tool: "append_drawio",
                toolCallId: toolCall.toolCallId,
                state: "output-error",
                errorText: `XML still incomplete (mxCell not closed). Call append_drawio again to continue.

Current ending:
\`\`\`
${partialXmlRef.current.slice(-500)}
\`\`\`

Continue from EXACTLY where you stopped.`,
            })
        }
    }

    return { handleToolCall }
}
