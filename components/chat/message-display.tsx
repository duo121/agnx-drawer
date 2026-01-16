"use client"

import type { UIMessage } from "ai"

import {
    Check,
    ChevronDown,
    ChevronUp,
    Copy,
    FileCode,
    FileText,
    X,
} from "lucide-react"
import Image from "next/image"
import type { MutableRefObject } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { toast } from "sonner"
import {
    Reasoning,
    ReasoningContent,
    ReasoningTrigger,
} from "@/components/ai-elements/reasoning"
import { ChatLobby } from "./ChatLobby"
import { ToolCallCard } from "./ToolCallCard"
import type { DiagramOperation, ToolPartLike } from "./types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useDictionary } from "@/hooks/use-dictionary"
import { getApiEndpoint } from "@/shared/base-path"
import {
    applyDiagramOperations,
    convertToLegalXml,
    extractCompleteMxCells,
    validateAndFixXml,
} from "@/shared/utils"
import type { ExcalidrawOperation } from "@/hooks/engines"

// Helper to extract complete operations from streaming input
function getCompleteOperations(
    operations: DiagramOperation[] | undefined,
): DiagramOperation[] {
    if (!operations || !Array.isArray(operations)) return []
    return operations.filter(
        (op) =>
            op &&
            typeof op.operation === "string" &&
            ["update", "add", "delete"].includes(op.operation) &&
            typeof op.cell_id === "string" &&
            op.cell_id.length > 0 &&
            (op.operation === "delete" || typeof op.new_xml === "string"),
    )
}

import { useEngine } from "@/hooks/engines/engine-context"

// Helper to split text content into regular text and file sections (PDF or text files)
interface TextSection {
    type: "text" | "file"
    content: string
    filename?: string
    charCount?: number
    fileType?: "pdf" | "text"
}

function splitTextIntoFileSections(text: string): TextSection[] {
    const sections: TextSection[] = []
    // Match [PDF: filename] or [File: filename] patterns
    const filePattern =
        /\[(PDF|File):\s*([^\]]+)\]\n([\s\S]*?)(?=\n\n\[(PDF|File):|$)/g
    let lastIndex = 0
    let match

    while ((match = filePattern.exec(text)) !== null) {
        // Add text before this file section
        const beforeText = text.slice(lastIndex, match.index).trim()
        if (beforeText) {
            sections.push({ type: "text", content: beforeText })
        }

        // Add file section
        const fileType = match[1].toLowerCase() === "pdf" ? "pdf" : "text"
        const filename = match[2].trim()
        const fileContent = match[3].trim()
        sections.push({
            type: "file",
            content: fileContent,
            filename,
            charCount: fileContent.length,
            fileType,
        })

        lastIndex = match.index + match[0].length
    }

    // Add remaining text after last file section
    const remainingText = text.slice(lastIndex).trim()
    if (remainingText) {
        sections.push({ type: "text", content: remainingText })
    }

    // If no file sections found, return original text
    if (sections.length === 0) {
        sections.push({ type: "text", content: text })
    }

    return sections
}

const getMessageTextContent = (message: UIMessage): string => {
    if (!message.parts) return ""
    return message.parts
        .filter((part) => part.type === "text")
        .map((part) => (part as { text: string }).text)
        .join("\n")
}

// Get only the user's original text, excluding appended file content
const getUserOriginalText = (message: UIMessage): string => {
    const fullText = getMessageTextContent(message)
    // Strip out [PDF: ...] and [File: ...] sections that were appended
    const filePattern = /\n\n\[(PDF|File):\s*[^\]]+\]\n[\s\S]*$/
    return fullText.replace(filePattern, "").trim()
}

interface SessionMetadata {
    id: string
    title: string
    updatedAt: number
    thumbnailDataUrl?: string
    engineId?: string
    messageCount?: number
}

interface ChatMessageDisplayProps {
    messages: UIMessage[]
    setInput: (input: string) => void
    setFiles: (files: File[]) => void
    processedToolCallsRef: MutableRefObject<Set<string>>
    editDiagramOriginalXmlRef: MutableRefObject<Map<string, string>>
    sessionId?: string
    onRegenerate?: (messageIndex: number) => void
    onEditMessage?: (messageIndex: number, newText: string) => void
    onDeleteMessage?: (messageIndex: number) => void
    onFocusInput?: () => void
    status?: "streaming" | "submitted" | "idle" | "error" | "ready"
    isRestored?: boolean
    sessions?: SessionMetadata[]
    onSelectSession?: (id: string) => void
    onDeleteSession?: (id: string) => void
    loadedMessageIdsRef?: MutableRefObject<Set<string>>
    currentEngine?: string
    onStop?: () => void
}

export function ChatMessageDisplay({
    messages,
    setInput,
    setFiles,
    processedToolCallsRef,
    editDiagramOriginalXmlRef,
    sessionId,
    onRegenerate,
    onEditMessage,
    onDeleteMessage,
    onFocusInput,
    status = "idle",
    isRestored = false,
    sessions = [],
    onSelectSession,
    onDeleteSession,
    loadedMessageIdsRef,
    currentEngine,
    onStop,
}: ChatMessageDisplayProps) {
    const dict = useDictionary()
    const {
        chartXML,
        loadDiagram: onDisplayChart,
        selectCells,
        getExcalidrawScene,
        setExcalidrawScene,
        selectExcalidrawElements,
        editExcalidrawByOperations,
    } = useEngine()
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const scrollTopRef = useRef<HTMLDivElement>(null)
    const previousXML = useRef<string>("")
    const processedToolCalls = processedToolCallsRef
    // Track the last processed XML per toolCallId to skip redundant processing during streaming
    const lastProcessedXmlRef = useRef<Map<string, string>>(new Map())

    // Reset refs when messages become empty (new chat or session switch)
    // This ensures cached examples work correctly after starting a new session
    useEffect(() => {
        if (messages.length === 0) {
            previousXML.current = ""
            lastProcessedXmlRef.current.clear()
            // Note: processedToolCalls is passed from parent, so we clear it too
            processedToolCalls.current.clear()
            // Scroll to top to show newest history items
            scrollTopRef.current?.scrollIntoView({ behavior: "instant" })
        }
    }, [messages.length, processedToolCalls])
    // Debounce streaming diagram updates - store pending XML and timeout
    const pendingXmlRef = useRef<string | null>(null)
    const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    )
    const STREAMING_DEBOUNCE_MS = 150 // Only update diagram every 150ms during streaming
    // Refs for edit_drawio streaming
    const pendingEditRef = useRef<{
        operations: DiagramOperation[]
        toolCallId: string
    } | null>(null)
    const editDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    )
    const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>(
        {},
    )
    const [copiedToolCallId, setCopiedToolCallId] = useState<string | null>(
        null,
    )
    const [copyFailedToolCallId, setCopyFailedToolCallId] = useState<
        string | null
    >(null)
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
    const [copyFailedMessageId, setCopyFailedMessageId] = useState<
        string | null
    >(null)
    const [feedback, setFeedback] = useState<Record<string, "good" | "bad">>({})
    // Track which PDF sections are expanded (key: messageId-sectionIndex)
    const [expandedPdfSections, setExpandedPdfSections] = useState<
        Record<string, boolean>
    >({})


    const setCopyState = (
        messageId: string,
        isToolCall: boolean,
        isSuccess: boolean,
    ) => {
        if (isSuccess) {
            if (isToolCall) {
                setCopiedToolCallId(messageId)
                setTimeout(() => setCopiedToolCallId(null), 2000)
            } else {
                setCopiedMessageId(messageId)
                setTimeout(() => setCopiedMessageId(null), 2000)
            }
        } else {
            if (isToolCall) {
                setCopyFailedToolCallId(messageId)
                setTimeout(() => setCopyFailedToolCallId(null), 2000)
            } else {
                setCopyFailedMessageId(messageId)
                setTimeout(() => setCopyFailedMessageId(null), 2000)
            }
        }
    }

    const copyMessageToClipboard = async (
        messageId: string,
        text: string,
        isToolCall = false,
    ) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopyState(messageId, isToolCall, true)
        } catch (_err) {
            // Fallback for non-secure contexts (HTTP) or permission denied
            const textarea = document.createElement("textarea")
            textarea.value = text
            textarea.style.position = "fixed"
            textarea.style.left = "-9999px"
            textarea.style.opacity = "0"
            document.body.appendChild(textarea)

            try {
                textarea.select()
                const success = document.execCommand("copy")
                if (!success) {
                    throw new Error("Copy command failed")
                }
                setCopyState(messageId, isToolCall, true)
            } catch (fallbackErr) {
                console.error("Failed to copy message:", fallbackErr)
                toast.error(dict.chat.failedToCopyDetail)
                setCopyState(messageId, isToolCall, false)
            } finally {
                document.body.removeChild(textarea)
            }
        }
    }

    const submitFeedback = async (messageId: string, value: "good" | "bad") => {
        // Toggle off if already selected
        if (feedback[messageId] === value) {
            setFeedback((prev) => {
                const next = { ...prev }
                delete next[messageId]
                return next
            })
            return
        }

        setFeedback((prev) => ({ ...prev, [messageId]: value }))

        try {
            await fetch(getApiEndpoint("/api/log-feedback"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messageId,
                    feedback: value,
                    sessionId,
                }),
            })
        } catch (error) {
            console.error("Failed to log feedback:", error)
            toast.error(dict.errors.failedToRecordFeedback)
            // Revert optimistic UI update
            setFeedback((prev) => {
                const next = { ...prev }
                delete next[messageId]
                return next
            })
        }
    }

    const handleDisplayChart = useCallback(
        (xml: string, showToast = false) => {
            let currentXml = xml || ""

            // During streaming (showToast=false), extract only complete mxCell elements
            // This allows progressive rendering even with partial/incomplete trailing XML
            if (!showToast) {
                const completeCells = extractCompleteMxCells(currentXml)
                if (!completeCells) {
                    return
                }
                currentXml = completeCells
            }

            const convertedXml = convertToLegalXml(currentXml)
            if (convertedXml !== previousXML.current) {
                // Parse and validate XML BEFORE calling replaceNodes
                const parser = new DOMParser()
                // Wrap in root element for parsing multiple mxCell elements
                const testDoc = parser.parseFromString(
                    `<root>${convertedXml}</root>`,
                    "text/xml",
                )
                const parseError = testDoc.querySelector("parsererror")

                if (parseError) {
                    // Only show toast if this is the final XML (not during streaming)
                    if (showToast) {
                        toast.error(dict.errors.malformedXml)
                    }
                    return // Skip this update
                }

                try {
                    // If chartXML is empty, create a default mxfile structure to use with replaceNodes
                    // This ensures the XML is properly wrapped in mxfile/diagram/mxGraphModel format
                    const baseXML =
                        chartXML ||
                        `<mxfile><diagram name="Page-1" id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`
                    // replaceNodes was removed; use baseXML directly for now
                    const replacedXML = baseXML

                    // During streaming (showToast=false), skip heavy validation for lower latency
                    // The quick DOM parse check above catches malformed XML
                    // Full validation runs on final output (showToast=true)
                    if (!showToast) {
                        previousXML.current = convertedXml
                        onDisplayChart(replacedXML, true)
                        return
                    }

                    // Final output: run full validation and auto-fix
                    const validation = validateAndFixXml(replacedXML)
                    if (validation.valid) {
                        previousXML.current = convertedXml
                        // Use fixed XML if available, otherwise use original
                        const xmlToLoad = validation.fixed || replacedXML
                        onDisplayChart(xmlToLoad, true)
                    } else {
                        toast.error(dict.errors.validationFailed)
                    }
                } catch (error) {
                    console.error("Error processing XML:", error)
                    // Only show toast if this is the final XML (not during streaming)
                    if (showToast) {
                        toast.error(dict.errors.failedToProcess)
                    }
                }
            }
        },
        [chartXML, onDisplayChart],
    )

    const handleReinsert = useCallback(
        async ({
            xml,
            code,
            toolName,
            excalidrawScene,
            operations,
            excalidrawOperations,
        }: {
            xml?: string
            code?: string
            toolName: string
            excalidrawScene?: { elements: any[]; appState?: any; files?: Record<string, any> }
            operations?: DiagramOperation[]
            excalidrawOperations?: ExcalidrawOperation[]
        }) => {
            // Handle edit_excalidraw with excalidrawOperations
            if (toolName === "edit_excalidraw" && excalidrawOperations && excalidrawOperations.length > 0) {
                console.log("[handleReinsert] edit_excalidraw with operations:", {
                    operationsCount: excalidrawOperations.length,
                })

                try {
                    const result = await editExcalidrawByOperations(excalidrawOperations)
                    if (result.newIds.length > 0) {
                        setTimeout(() => selectExcalidrawElements(result.newIds), 10)
                    }
                } catch (error) {
                    console.error("[handleReinsert] edit_excalidraw failed:", error)
                    toast.error("Excalidraw 编辑操作执行失败")
                }
                return
            }

            // Handle edit_drawio with operations
            if (toolName === "edit_drawio" && operations && operations.length > 0) {
                console.log("[handleReinsert] edit_drawio with operations:", {
                    operationsCount: operations.length,
                    hasChartXML: !!chartXML,
                })

                if (!chartXML) {
                    toast.error("没有可编辑的图表")
                    return
                }

                try {
                    const { result: editedXml, errors } = applyDiagramOperations(chartXML, operations)
                    if (errors.length > 0) {
                        console.warn("[handleReinsert] edit_drawio errors:", errors)
                    }
                    onDisplayChart(editedXml, true)
                    // 选中被操作的 cell
                    const affectedIds = operations
                        .filter(op => op.cell_id && op.operation !== "delete")
                        .map(op => op.cell_id)
                    if (selectCells && affectedIds.length > 0) {
                        setTimeout(() => selectCells(affectedIds), 30)
                    }
                } catch (error) {
                    console.error("[handleReinsert] edit_drawio failed:", error)
                    toast.error("编辑操作执行失败")
                }
                return
            }

            // Excalidraw reinsertion: merge elements and select newly added
            if (toolName.includes("excalidraw")) {
                console.log("[handleReinsert] Excalidraw tool:", {
                    toolName,
                    hasScene: !!excalidrawScene,
                    hasCode: !!code,
                    elementsCount: excalidrawScene?.elements?.length || 0,
                })
                
                // 如果是 Mermaid 工具且有 code，重新转换
                if (toolName === "convert_mermaid_to_excalidraw" && code && (!excalidrawScene || !excalidrawScene.elements || excalidrawScene.elements.length === 0)) {
                    console.log("[handleReinsert] Re-converting from Mermaid code")
                    try {
                        const { convertMermaidToExcalidraw } = await import("@/shared/script-convertor")
                        const result = await convertMermaidToExcalidraw(code, {
                            isDark: false, // TODO: 从主题获取
                        })
                        excalidrawScene = {
                            elements: result.elements,
                            files: result.files,
                        }
                        console.log("[handleReinsert] Re-converted:", {
                            elementsCount: result.elements.length,
                        })
                    } catch (error) {
                        console.error("[handleReinsert] Re-conversion failed:", error)
                        toast.error("重新转换 Mermaid 失败")
                        return
                    }
                } else if (toolName === "convert_mermaid_to_excalidraw" && !code) {
                    // 旧的失败记录，没有保存 code
                    console.warn("[handleReinsert] No Mermaid code available in old record")
                    toast.error("旧的工具记录无法重新插入，请发送新的请求")
                    return
                }
                
                if (!excalidrawScene || !Array.isArray(excalidrawScene.elements)) {
                    toast.error("没有可插入的 Excalidraw 元素")
                    return
                }
                
                if (excalidrawScene.elements.length === 0) {
                    toast.error("Excalidraw 元素数组为空，转换可能失败")
                    return
                }
                const sanitize = (elements: any[] = []) => {
                    const toNumber = (val: any, fallback: number) =>
                        typeof val === "number" && Number.isFinite(val) ? val : fallback
                    return elements
                        .filter((el) => el && typeof el === "object")
                        .map((el) => {
                            const width = toNumber(el.width, 100)
                            const height = toNumber(el.height, 60)
                            return {
                                version: el?.version ?? 1,
                                versionNonce:
                                    el?.versionNonce ??
                                    Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
                                updated: el?.updated ?? Date.now(),
                                ...el,
                                x: toNumber(el?.x, 0),
                                y: toNumber(el?.y, 0),
                                width,
                                height,
                                angle: toNumber(el?.angle, 0),
                                strokeWidth: toNumber(el?.strokeWidth, 2),
                                roughness: toNumber(el?.roughness, 0),
                                opacity: toNumber(el?.opacity, 100),
                            }
                        })
                }
                const current = getExcalidrawScene()
                const map = new Map<string, any>()
                ;(current.elements || []).forEach((el: any) => {
                    if (el?.id) map.set(el.id, el)
                })
                const newIds: string[] = []
                const incoming = sanitize(excalidrawScene.elements)
                incoming.forEach((el) => {
                    if (el?.id) {
                        newIds.push(el.id)
                        map.set(el.id, el)
                    } else {
                        const syntheticId = `el-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
                        newIds.push(syntheticId)
                        map.set(syntheticId, { ...el, id: syntheticId })
                    }
                })

                const nextScene = {
                    elements: Array.from(map.values()),
                    appState: { ...(current.appState || {}), ...(excalidrawScene.appState || {}) },
                    files:
                        Array.from(map.values()).length === 0
                            ? {}
                            : { ...(current.files || {}), ...(excalidrawScene.files || {}) },
                }
                setExcalidrawScene(nextScene)
                if (newIds.length > 0) {
                    setTimeout(() => selectExcalidrawElements(newIds), 10)
                }
                return
            }
            let finalXml = xml
            if (!finalXml && code && toolName === "convert_plantuml_to_drawio") {
                try {
                    const { convertPlantUMLToDrawio } = await import(
                        "@/shared/script-convertor"
                    )
                    finalXml = await convertPlantUMLToDrawio(code)
                } catch (err) {
                    console.error("[handleReinsert] convert failed:", err)
                }
            }
            if (!finalXml) {
                console.warn("[handleReinsert] Missing XML")
                toast.error("没有可插入的 XML")
                return
            }

            const wrapWithMxFile = (cellsXml: string): string => `
<mxfile host="app.diagrams.net">
  <diagram>
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        ${cellsXml}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`.trim()

            // Append nodes to current diagram without removing existing
            const appendNodes = (
                baseXml: string,
                nodesXml: string,
            ): { xml: string; newIds: string[] } => {
                try {
                    const parser = new DOMParser()
                    const baseDoc = parser.parseFromString(baseXml, "text/xml")
                    const baseRoot =
                        baseDoc.querySelector("mxGraphModel > root") ||
                        baseDoc.querySelector("root")
                    if (!baseRoot) return { xml: baseXml, newIds: [] }

                    const nodesDoc = parser.parseFromString(
                        nodesXml.includes("<root>")
                            ? nodesXml
                            : `<root>${nodesXml}</root>`,
                        "text/xml",
                    )
                    const nodesRoot = nodesDoc.querySelector("root")
                    if (!nodesRoot) return { xml: baseXml, newIds: [] }

                    const existingIds = new Set<string>()
                    baseRoot.querySelectorAll("mxCell[id]").forEach((n) => {
                        const id = (n as Element).getAttribute("id")
                        if (id) existingIds.add(id)
                    })

                    const newIds: string[] = []
                    nodesRoot.childNodes.forEach((n) => {
                        if (n.nodeType !== 1) return
                        const el = n as Element
                        const id = el.getAttribute("id")
                        if (id && existingIds.has(id)) return
                        if (id) newIds.push(id)
                        const imported = baseDoc.importNode(el, true)
                        baseRoot.appendChild(imported)
                    })

                    const serializer = new XMLSerializer()
                    return { xml: serializer.serializeToString(baseDoc), newIds }
                } catch (err) {
                    console.warn("[appendNodes] failed", err)
                    return { xml: baseXml, newIds: [] }
                }
            }

            const { xml: mergedXml, newIds } = chartXML
                ? appendNodes(chartXML, finalXml)
                : { xml: wrapWithMxFile(finalXml), newIds: [] }

            onDisplayChart(mergedXml, true)
            if (selectCells) {
                // 插入后默认全选，保持与原生 Cmd+A 一致；新 ID 仅作备用
                setTimeout(
                    () => selectCells(newIds.length > 0 ? newIds : undefined),
                    30,
                )
            }
        },
        [
            chartXML,
            getExcalidrawScene,
            onDisplayChart,
            selectCells,
            selectExcalidrawElements,
            setExcalidrawScene,
        ],
    )

    // Track previous message count to detect bulk loads vs streaming
    const prevMessageCountRef = useRef(0)

    useEffect(() => {
        if (messagesEndRef.current && messages.length > 0) {
            const prevCount = prevMessageCountRef.current
            const currentCount = messages.length
            prevMessageCountRef.current = currentCount

            // Bulk load (session restore) - instant scroll, no animation
            if (prevCount === 0 || currentCount - prevCount > 1) {
                messagesEndRef.current.scrollIntoView({ behavior: "instant" })
                return
            }

            // Single message added - smooth scroll
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }, [messages])


    useEffect(() => {
        // Only process the last message for streaming performance
        // Previous messages are already processed and won't change
        const messagesToProcess =
            messages.length > 0 ? [messages[messages.length - 1]] : []

        messagesToProcess.forEach((message) => {
            if (message.parts) {
                message.parts.forEach((part) => {
                    if (part.type?.startsWith("tool-")) {
                        const toolPart = part as ToolPartLike
                        const { toolCallId, state, input } = toolPart

                        if (state === "output-available") {
                            setExpandedTools((prev) => ({
                                ...prev,
                                [toolCallId]: false,
                            }))
                        }

                        if (
                            part.type === "tool-display_drawio" &&
                            input?.xml
                        ) {
                            const xml = input.xml as string

                            // Skip if XML hasn't changed since last processing
                            const lastXml =
                                lastProcessedXmlRef.current.get(toolCallId)
                            if (lastXml === xml) {
                                return // Skip redundant processing
                            }

                            if (
                                state === "input-streaming" ||
                                state === "input-available"
                            ) {
                                // Debounce streaming updates - queue the XML and process after delay
                                pendingXmlRef.current = xml

                                if (!debounceTimeoutRef.current) {
                                    // No pending timeout - set one up
                                    debounceTimeoutRef.current = setTimeout(
                                        () => {
                                            const pendingXml =
                                                pendingXmlRef.current
                                            debounceTimeoutRef.current = null
                                            pendingXmlRef.current = null
                                            if (pendingXml) {
                                                handleDisplayChart(
                                                    pendingXml,
                                                    false,
                                                )
                                                lastProcessedXmlRef.current.set(
                                                    toolCallId,
                                                    pendingXml,
                                                )
                                            }
                                        },
                                        STREAMING_DEBOUNCE_MS,
                                    )
                                }
                            } else if (
                                state === "output-available" &&
                                !processedToolCalls.current.has(toolCallId)
                            ) {
                                // Final output - process immediately (clear any pending debounce)
                                if (debounceTimeoutRef.current) {
                                    clearTimeout(debounceTimeoutRef.current)
                                    debounceTimeoutRef.current = null
                                    pendingXmlRef.current = null
                                }
                                // Show toast only if final XML is malformed
                                handleDisplayChart(xml, true)
                                processedToolCalls.current.add(toolCallId)
                                // Clean up the ref entry - tool is complete, no longer needed
                                lastProcessedXmlRef.current.delete(toolCallId)
                            }
                        }

                        // Handle edit_drawio streaming - apply operations incrementally for preview
                        // Uses shared editDiagramOriginalXmlRef to coordinate with tool handler
                        if (
                            part.type === "tool-edit_drawio" &&
                            input?.operations
                        ) {
                            const completeOps = getCompleteOperations(
                                input.operations as DiagramOperation[],
                            )

                            if (completeOps.length === 0) return

                            // Capture original XML when streaming starts (store in shared ref)
                            if (
                                !editDiagramOriginalXmlRef.current.has(
                                    toolCallId,
                                )
                            ) {
                                if (!chartXML) {
                                    console.warn(
                                        "[edit_drawio streaming] No chart XML available",
                                    )
                                    return
                                }
                                editDiagramOriginalXmlRef.current.set(
                                    toolCallId,
                                    chartXML,
                                )
                            }

                            const originalXml =
                                editDiagramOriginalXmlRef.current.get(
                                    toolCallId,
                                )
                            if (!originalXml) return

                            // Skip if no change from last processed state
                            const lastCount = lastProcessedXmlRef.current.get(
                                toolCallId + "-opCount",
                            )
                            if (lastCount === String(completeOps.length)) return

                            if (
                                state === "input-streaming" ||
                                state === "input-available"
                            ) {
                                // Queue the operations for debounced processing
                                pendingEditRef.current = {
                                    operations: completeOps,
                                    toolCallId,
                                }

                                if (!editDebounceTimeoutRef.current) {
                                    editDebounceTimeoutRef.current = setTimeout(
                                        () => {
                                            const pending =
                                                pendingEditRef.current
                                            editDebounceTimeoutRef.current =
                                                null
                                            pendingEditRef.current = null

                                            if (pending) {
                                                const origXml =
                                                    editDiagramOriginalXmlRef.current.get(
                                                        pending.toolCallId,
                                                    )
                                                if (!origXml) return

                                                try {
                                                    const {
                                                        result: editedXml,
                                                    } = applyDiagramOperations(
                                                        origXml,
                                                        pending.operations,
                                                    )
                                                    handleDisplayChart(
                                                        editedXml,
                                                        false,
                                                    )
                                                    lastProcessedXmlRef.current.set(
                                                        pending.toolCallId +
                                                            "-opCount",
                                                        String(
                                                            pending.operations
                                                                .length,
                                                        ),
                                                    )
                                                } catch (e) {
                                                    console.warn(
                                                        `[edit_drawio streaming] Operation failed:`,
                                                        e instanceof Error
                                                            ? e.message
                                                            : e,
                                                    )
                                                }
                                            }
                                        },
                                        STREAMING_DEBOUNCE_MS,
                                    )
                                }
                            } else if (
                                state === "output-available" &&
                                !processedToolCalls.current.has(toolCallId)
                            ) {
                                // Final state - cleanup streaming refs (tool handler does final application)
                                if (editDebounceTimeoutRef.current) {
                                    clearTimeout(editDebounceTimeoutRef.current)
                                    editDebounceTimeoutRef.current = null
                                }
                                lastProcessedXmlRef.current.delete(
                                    toolCallId + "-opCount",
                                )
                                processedToolCalls.current.add(toolCallId)
                                // Note: Don't delete editDiagramOriginalXmlRef here - tool handler needs it
                            }
                        }
                    }
                })
            }
        })

        // NOTE: Don't cleanup debounce timeouts here!
        // The cleanup runs on every re-render (when messages changes),
        // which would cancel the timeout before it fires.
        // Let the timeouts complete naturally - they're harmless if component unmounts.
    }, [messages, handleDisplayChart, chartXML])

    return (
        <ScrollArea className="h-full w-full scrollbar-thin">
            <div ref={scrollTopRef} />
            {messages.length === 0 && isRestored ? (
                <ChatLobby
                    sessions={sessions}
                    onSelectSession={onSelectSession || (() => {})}
                    onDeleteSession={onDeleteSession}
                    currentEngine={currentEngine}
                    dict={dict}
                />
            ) : messages.length === 0 ? null : (
                <div className="py-4 px-4 space-y-4">
                    {messages.map((message, messageIndex) => {
                        const userMessageText =
                            message.role === "user"
                                ? getMessageTextContent(message)
                                : ""
                        const isLastAssistantMessage =
                            message.role === "assistant" &&
                            (messageIndex === messages.length - 1 ||
                                messages
                                    .slice(messageIndex + 1)
                                    .every((m) => m.role !== "assistant"))
                        const isLastUserMessage =
                            message.role === "user" &&
                            (messageIndex === messages.length - 1 ||
                                messages
                                    .slice(messageIndex + 1)
                                    .every((m) => m.role !== "user"))
                        // Skip animation for loaded messages (from session restore)
                        const isRestoredMessage =
                            loadedMessageIdsRef?.current.has(message.id) ??
                            false
                        return (
                            <div
                                key={message.id}
                                className={`flex w-full ${message.role === "user" ? "justify-end" : "justify-start"} ${isRestoredMessage ? "" : "animate-message-in"}`}
                                style={
                                    isRestoredMessage
                                        ? undefined
                                        : {
                                              animationDelay: `${messageIndex * 50}ms`,
                                          }
                                }
                            >
                                <div className={message.role === "user" ? "max-w-[85%] min-w-0" : "flex-1 min-w-0"}>
                                    {/* Reasoning blocks - displayed first for assistant messages */}
                                    {message.role === "assistant" &&
                                        message.parts?.map(
                                            (part, partIndex) => {
                                                if (part.type === "reasoning") {
                                                    const reasoningPart =
                                                        part as {
                                                            type: "reasoning"
                                                            text: string
                                                        }
                                                    const isLastPart =
                                                        partIndex ===
                                                        (message.parts
                                                            ?.length ?? 0) -
                                                            1
                                                    const isLastMessage =
                                                        message.id ===
                                                        messages[
                                                            messages.length - 1
                                                        ]?.id
                                                    const isStreamingReasoning =
                                                        status ===
                                                            "streaming" &&
                                                        isLastPart &&
                                                        isLastMessage

                                                    return (
                                                        <Reasoning
                                                            key={`${message.id}-reasoning-${partIndex}`}
                                                            className="w-full"
                                                            isStreaming={
                                                                isStreamingReasoning
                                                            }
                                                            defaultOpen={
                                                                !isRestoredMessage
                                                            }
                                                        >
                                                            <ReasoningTrigger />
                                                            <ReasoningContent>
                                                                {
                                                                    reasoningPart.text
                                                                }
                                                            </ReasoningContent>
                                                        </Reasoning>
                                                    )
                                                }
                                                return null
                                            },
                                        )}
                                    {(
                                        /* Render parts in order, grouping consecutive text/file parts into bubbles */
                                        (() => {
                                            const parts = message.parts || []
                                            const groups: {
                                                type: "content" | "tool"
                                                parts: typeof parts
                                                startIndex: number
                                            }[] = []

                                            parts.forEach((part, index) => {
                                                const isToolPart =
                                                    part.type?.startsWith(
                                                        "tool-",
                                                    )
                                                const isContentPart =
                                                    part.type === "text" ||
                                                    part.type === "file"

                                                if (isToolPart) {
                                                    groups.push({
                                                        type: "tool",
                                                        parts: [part],
                                                        startIndex: index,
                                                    })
                                                } else if (isContentPart) {
                                                    const lastGroup =
                                                        groups[
                                                            groups.length - 1
                                                        ]
                                                    if (
                                                        lastGroup?.type ===
                                                        "content"
                                                    ) {
                                                        lastGroup.parts.push(
                                                            part,
                                                        )
                                                    } else {
                                                        groups.push({
                                                            type: "content",
                                                            parts: [part],
                                                            startIndex: index,
                                                        })
                                                    }
                                                }
                                            })

                                            return groups.map(
                                                (group, groupIndex) => {
                                                    if (group.type === "tool") {
                                                        return (
                                                            <ToolCallCard
                                                                key={`${message.id}-tool-${group.startIndex}`}
                                                                part={
                                                                    group
                                                                        .parts[0] as ToolPartLike
                                                                }
                                                                expandedTools={
                                                                    expandedTools
                                                                }
                                                                setExpandedTools={
                                                                    setExpandedTools
                                                                }
                                                                onCopy={
                                                                    copyMessageToClipboard
                                                                }
                                                                onReinsert={
                                                                    handleReinsert
                                                                }
                                                                copiedToolCallId={
                                                                    copiedToolCallId
                                                                }
                                                                copyFailedToolCallId={
                                                                    copyFailedToolCallId
                                                                }
                                                                dict={dict}
                                                            />
                                                        )
                                                    }

                                                    // Content bubble
                                                    // 检查是否所有文本内容都是空白
                                                    const hasNonEmptyContent = group.parts.some(part => {
                                                        if (part.type === "text") {
                                                            const text = (part as { text: string }).text
                                                            return text && text.trim().length > 0
                                                        }
                                                        return part.type === "file"
                                                    })

                                                    // 如果没有非空内容，不渲染气泡
                                                    if (!hasNonEmptyContent) {
                                                        return null
                                                    }

                                                    return (
                                                        <div
                                                            key={`${message.id}-content-${group.startIndex}`}
                                                            className={`px-4 py-3 text-sm leading-relaxed ${
                                                                message.role ===
                                                                "user"
                                                                    ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md shadow-sm"
                                                                    : message.role ===
                                                                        "system"
                                                                      ? "bg-destructive/10 text-destructive border border-destructive/20 rounded-2xl rounded-bl-md"
                                                                      : "bg-muted/60 text-foreground rounded-2xl rounded-bl-md"
                                                            } ${groupIndex > 0 ? "mt-3" : ""}`}
                                                            onContextMenu={(e) => {
                                                                e.preventDefault()
                                                                const textContent = message.role === "user" 
                                                                    ? getUserOriginalText(message)
                                                                    : getMessageTextContent(message)
                                                                
                                                                // 移除所有已存在的右键菜单
                                                                document.querySelectorAll('[data-context-menu]').forEach(el => el.remove())
                                                                
                                                                // 创建右键菜单
                                                                const menu = document.createElement('div')
                                                                menu.setAttribute('data-context-menu', 'true')
                                                                menu.className = 'fixed bg-popover text-popover-foreground border border-border rounded-lg shadow-lg py-1 z-50'
                                                                menu.style.left = `${e.clientX}px`
                                                                menu.style.top = `${e.clientY}px`
                                                                menu.style.minWidth = 'max-content'
                                                                menu.style.width = 'auto'
                                                                
                                                                const createMenuItem = (label: string, onClick: () => void) => {
                                                                    const item = document.createElement('button')
                                                                    item.className = 'w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors'
                                                                    item.textContent = label
                                                                    item.onclick = () => {
                                                                        onClick()
                                                                        if (menu.parentNode) {
                                                                            document.body.removeChild(menu)
                                                                        }
                                                                        document.removeEventListener('click', closeMenu)
                                                                    }
                                                                    return item
                                                                }
                                                                
                                                                const createDivider = () => {
                                                                    const divider = document.createElement('div')
                                                                    divider.className = 'h-px bg-border my-1'
                                                                    return divider
                                                                }
                                                                
                                                                // 复制选项
                                                                menu.appendChild(createMenuItem(dict.chat.copyResponse, () => {
                                                                    copyMessageToClipboard(message.id, textContent)
                                                                }))
                                                                
                                                                // 人类消息:编辑选项
                                                                if (message.role === "user" && onEditMessage) {
                                                                    menu.appendChild(createDivider())
                                                                    menu.appendChild(createMenuItem(dict.chat.editMessage, () => {
                                                                        if ((status === "streaming" || status === "submitted") && onStop) {
                                                                            onStop()
                                                                        }
                                                                        setInput(textContent)
                                                                        // Focus input after setting text
                                                                        setTimeout(() => {
                                                                            onFocusInput?.()
                                                                        }, 0)
                                                                    }))
                                                                }
                                                                
                                                                // AI消息：重新生成选项
                                                                if (message.role === "assistant" && onRegenerate && isLastAssistantMessage && 
                                                                    !message.parts?.some((p: any) => p.toolCallId?.startsWith("cached-"))) {
                                                                    // Disable regenerate if AI is processing
                                                                    const isDisabled = status === "streaming" || status === "submitted"
                                                                    menu.appendChild(createDivider())
                                                                    const regenerateItem = createMenuItem(dict.chat.regenerate, () => {
                                                                        if (!isDisabled) {
                                                                            onRegenerate(messageIndex)
                                                                        }
                                                                    })
                                                                    if (isDisabled) {
                                                                        regenerateItem.classList.add('opacity-50', 'cursor-not-allowed')
                                                                        regenerateItem.disabled = true
                                                                    }
                                                                    menu.appendChild(regenerateItem)
                                                                }
                                                                
                                                                // 删除消息选项
                                                                if (onDeleteMessage) {
                                                                    const isDisabled = status === "streaming" || status === "submitted"
                                                                    menu.appendChild(createDivider())
                                                                    const deleteItem = createMenuItem(dict.chat.deleteMessage, () => {
                                                                        if (!isDisabled) {
                                                                            onDeleteMessage(messageIndex)
                                                                        }
                                                                    })
                                                                    if (isDisabled) {
                                                                        deleteItem.classList.add('opacity-50', 'cursor-not-allowed')
                                                                        deleteItem.disabled = true
                                                                    }
                                                                    deleteItem.classList.add('text-destructive')
                                                                    menu.appendChild(deleteItem)
                                                                }
                                                                
                                                                document.body.appendChild(menu)
                                                                
                                                                // 点击外部关闭菜单
                                                                const closeMenu = (e: MouseEvent) => {
                                                                    if (!menu.contains(e.target as Node)) {
                                                                        if (menu.parentNode) {
                                                                            document.body.removeChild(menu)
                                                                        }
                                                                        document.removeEventListener('click', closeMenu)
                                                                    }
                                                                }
                                                                setTimeout(() => document.addEventListener('click', closeMenu), 0)
                                                            }}
                                                        >
                                                            {group.parts.map(
                                                                (
                                                                    part,
                                                                    partIndex,
                                                                ) => {
                                                                    if (
                                                                        part.type ===
                                                                        "text"
                                                                    ) {
                                                                        const textContent =
                                                                            (
                                                                                part as {
                                                                                    text: string
                                                                                }
                                                                            )
                                                                                .text

                                                                        // 过滤纯空白文本（只有空格、换行等）
                                                                        if (!textContent || !textContent.trim()) {
                                                                            return null
                                                                        }

                                                                        const sections =
                                                                            splitTextIntoFileSections(
                                                                                textContent,
                                                                            )
                                                                        return (
                                                                            <div
                                                                                key={`${message.id}-text-${group.startIndex}-${partIndex}`}
                                                                                className="space-y-2"
                                                                            >
                                                                                {sections.map(
                                                                                    (
                                                                                        section,
                                                                                        sectionIndex,
                                                                                    ) => {
                                                                                        if (
                                                                                            section.type ===
                                                                                            "file"
                                                                                        ) {
                                                                                            const pdfKey = `${message.id}-file-${partIndex}-${sectionIndex}`
                                                                                            const isExpanded =
                                                                                                expandedPdfSections[
                                                                                                    pdfKey
                                                                                                ] ??
                                                                                                false
                                                                                            const charDisplay =
                                                                                                section.charCount &&
                                                                                                section.charCount >=
                                                                                                    1000
                                                                                                    ? `${(section.charCount / 1000).toFixed(1)}k`
                                                                                                    : section.charCount
                                                                                            return (
                                                                                                <div
                                                                                                    key={
                                                                                                        pdfKey
                                                                                                    }
                                                                                                    className="rounded-lg border border-border/60 bg-muted/30 overflow-hidden"
                                                                                                >
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={(
                                                                                                            e,
                                                                                                        ) => {
                                                                                                            e.stopPropagation()
                                                                                                            setExpandedPdfSections(
                                                                                                                (
                                                                                                                    prev,
                                                                                                                ) => ({
                                                                                                                    ...prev,
                                                                                                                    [pdfKey]:
                                                                                                                        !isExpanded,
                                                                                                                }),
                                                                                                            )
                                                                                                        }}
                                                                                                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
                                                                                                    >
                                                                                                        <div className="flex items-center gap-2">
                                                                                                            {section.fileType ===
                                                                                                            "pdf" ? (
                                                                                                                <FileText className="h-4 w-4 text-red-500" />
                                                                                                            ) : (
                                                                                                                <FileCode className="h-4 w-4 text-blue-500" />
                                                                                                            )}
                                                                                                            <span className="text-xs font-medium">
                                                                                                                {
                                                                                                                    section.filename
                                                                                                                }
                                                                                                            </span>
                                                                                                            <span className="text-[10px] text-muted-foreground">
                                                                                                                (
                                                                                                                {
                                                                                                                    charDisplay
                                                                                                                }{" "}
                                                                                                                chars)
                                                                                                            </span>
                                                                                                        </div>
                                                                                                        {isExpanded ? (
                                                                                                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                                                                        ) : (
                                                                                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                                                                        )}
                                                                                                    </button>
                                                                                                    {isExpanded && (
                                                                                                        <div className="px-3 py-2 border-t border-border/40 max-h-48 overflow-y-auto bg-muted/30">
                                                                                                            <pre className="text-xs whitespace-pre-wrap text-foreground/80">
                                                                                                                {
                                                                                                                    section.content
                                                                                                                }
                                                                                                            </pre>
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                            )
                                                                                        }
                                                                                        // Regular text section
                                                                                        return (
                                                                                          <div
                                                                                            key={`${message.id}-textsection-${partIndex}-${sectionIndex}`}
                                                                                            className={`prose prose-sm max-w-none wrap-break-word [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 ${
                                                                                              message.role === "user"
                                                                                                ? "**:text-primary-foreground prose-code:bg-white/20"
                                                                                                : "dark:prose-invert"
                                                                                            }`}
                                                                                          >
                                                                                            <ReactMarkdown>
                                                                                              {section.content}
                                                                                            </ReactMarkdown>
                                                                                          </div>
                                                                                        );
                                                                                    },
                                                                                )}
                                                                            </div>
                                                                        )
                                                                    }
                                                                    if (
                                                                        part.type ===
                                                                        "file"
                                                                    ) {
                                                                        return (
                                                                            <div
                                                                                key={`${message.id}-file-${group.startIndex}-${partIndex}`}
                                                                                className="mt-2"
                                                                            >
                                                                                <Image
                                                                                    src={
                                                                                        (
                                                                                            part as {
                                                                                                url: string
                                                                                            }
                                                                                        )
                                                                                            .url
                                                                                    }
                                                                                    width={
                                                                                        200
                                                                                    }
                                                                                    height={
                                                                                        200
                                                                                    }
                                                                                    alt={`Uploaded diagram or image for AI analysis`}
                                                                                    className="rounded-lg border border-white/20"
                                                                                    style={{
                                                                                        objectFit:
                                                                                            "contain",
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        )
                                                                    }
                                                                    return null
                                                                },
                                                            )}
                                                        </div>
                                                    )
                                                },
                                            )
                                        })()
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
            <div ref={messagesEndRef} />
        </ScrollArea>
    )
}
