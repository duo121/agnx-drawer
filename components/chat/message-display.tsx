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
import { cn } from "@/shared/utils"
import { ChatLobby } from "./chat-lobby"
import { ToolCallCard } from "./tool-call-card"
import type { DiagramOperation, ToolPartLike } from "./types"
import { useDictionary } from "@/hooks/use-dictionary"
import { getApiEndpoint } from "@/shared/base-path"
import { applyDiagramOperations } from "@/shared/utils"
import type { ExcalidrawOperation } from "@/hooks/engines"
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
    loadedMessageIdsRef?: MutableRefObject<Set<string>>
    onStop?: () => void
    // Share mode: allow multi-select messages for export
    shareMode?: boolean
    selectedMessageIds?: Set<string>
    onToggleMessageSelected?: (messageId: string) => void
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
    loadedMessageIdsRef,
    onStop,
    shareMode = false,
    selectedMessageIds,
    onToggleMessageSelected,
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
    const processedToolCalls = processedToolCallsRef

    // Reset refs when messages become empty (new chat or session switch)
    // This ensures cached examples work correctly after starting a new session
    useEffect(() => {
        if (messages.length === 0) {
            // Note: processedToolCalls is passed from parent, so we clear it too
            processedToolCalls.current.clear()
            // Scroll to top to show newest history items
            scrollTopRef.current?.scrollIntoView({ behavior: "instant" })
        }
    }, [messages.length, processedToolCalls])

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
                
                // 对于 Mermaid 工具，始终使用 code 重新转换
                // 因为保存的 excalidrawScene 可能没有经过最新的过滤逻辑处理
                if (toolName === "convert_mermaid_to_excalidraw") {
                    if (!code) {
                        // 旧的失败记录，没有保存 code
                        console.warn("[handleReinsert] No Mermaid code available in old record")
                        toast.error("旧的工具记录无法重新插入，请发送新的请求")
                        return
                    }
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
                            textElements: result.elements.filter((e: any) => e.type === 'text').length,
                        })
                    } catch (error) {
                        console.error("[handleReinsert] Re-conversion failed:", error)
                        toast.error("重新转换 Mermaid 失败")
                        return
                    }
                }
                
                if (!excalidrawScene || !Array.isArray(excalidrawScene.elements)) {
                    toast.error("没有可插入的 Excalidraw 元素")
                    return
                }
                
                if (excalidrawScene.elements.length === 0) {
                    toast.error("Excalidraw 元素数组为空，转换可能失败")
                    return
                }
                // 确保元素有效，保留所有原有属性（包括 text、containerId 等）
                const sanitize = (elements: any[] = []) => {
                    const toNumber = (val: any, fallback: number) =>
                        typeof val === "number" && Number.isFinite(val) ? val : fallback
                    return elements
                        .filter((el) => el && typeof el === "object")
                        .map((el) => {
                            // 复制原始元素，保留所有属性
                            const result = { ...el }
                            
                            // 只填充缺失的必要字段
                            if (result.version === undefined) result.version = 1
                            if (result.versionNonce === undefined) {
                                result.versionNonce = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
                            }
                            if (result.updated === undefined) result.updated = Date.now()
                            
                            // 数值字段
                            result.x = toNumber(result.x, 0)
                            result.y = toNumber(result.y, 0)
                            result.width = toNumber(result.width, 100)
                            result.height = toNumber(result.height, 60)
                            result.angle = toNumber(result.angle, 0)
                            result.strokeWidth = toNumber(result.strokeWidth, 2)
                            result.roughness = toNumber(result.roughness, 0)
                            result.opacity = toNumber(result.opacity, 100)
                            
                            return result
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

                        // NOTE: display_drawio streaming preview is DISABLED
                        // The tool handler (handleDisplayDrawio) properly loads the diagram.
                        // Streaming preview caused race conditions where the debounced update
                        // would overwrite the correctly loaded diagram with malformed XML.
                        // Only track processed state for cleanup purposes.
                        if (
                            part.type === "tool-display_drawio" &&
                            state === "output-available" &&
                            !processedToolCalls.current.has(toolCallId)
                        ) {
                            processedToolCalls.current.add(toolCallId)
                        }

                        // NOTE: edit_drawio streaming preview is DISABLED
                        // The tool handler (handleEditDrawio) properly loads the diagram.
                        // Streaming preview caused race conditions where the debounced update
                        // would overwrite the correctly loaded diagram with malformed XML
                        // (duplicate root elements, duplicate IDs).
                        // We still need to capture the original XML for the tool handler.
                        if (
                            part.type === "tool-edit_drawio" &&
                            input?.operations
                        ) {
                            // Capture original XML when streaming starts (store in shared ref)
                            // This is needed by the tool handler for applying operations
                            if (
                                (state === "input-streaming" || state === "input-available") &&
                                !editDiagramOriginalXmlRef.current.has(toolCallId)
                            ) {
                                if (chartXML) {
                                    editDiagramOriginalXmlRef.current.set(
                                        toolCallId,
                                        chartXML,
                                    )
                                }
                            }

                            // Track processed state for cleanup
                            if (
                                state === "output-available" &&
                                !processedToolCalls.current.has(toolCallId)
                            ) {
                                processedToolCalls.current.add(toolCallId)
                                // Note: Don't delete editDiagramOriginalXmlRef here - tool handler needs it
                            }
                        }
                    }
                })
            }
        })

        // Note: chartXML is needed for capturing original XML for edit_drawio
    }, [messages, chartXML])

    // Handle prompt click from AnimatedDemo
    const handlePromptClick = (prompt: string) => {
        setInput(prompt)
        onFocusInput?.()
    }

    return (
        <div className="h-full w-full">
            <div ref={scrollTopRef} />
            {messages.length === 0 && isRestored ? (
                <ChatLobby onPromptClick={handlePromptClick} />
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
                        const isSelected = selectedMessageIds?.has(message.id) ?? false
                        return (
                            <div
                                key={message.id}
                                className={`flex w-full items-start gap-2 ${isRestoredMessage ? "" : "animate-message-in"}`}
                                style={
                                    isRestoredMessage
                                        ? undefined
                                        : {
                                              animationDelay: `${messageIndex * 50}ms`,
                                          }
                                }
                            >
                                {shareMode && (
                                    <button
                                        type="button"
                                        className="self-stretch w-6 shrink-0 flex items-center justify-center hover:bg-muted/50 rounded-l-lg transition-colors -ml-2 pl-2"
                                        onClick={() => onToggleMessageSelected?.(message.id)}
                                    >
                                        <span
                                            className={cn(
                                                "h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors",
                                                isSelected 
                                                    ? "border-primary bg-primary" 
                                                    : "border-border bg-background",
                                            )}
                                        >
                                            {isSelected && (
                                                <Check className="h-2.5 w-2.5 text-primary-foreground" />
                                            )}
                                        </span>
                                    </button>
                                )}
                                <div
                                    className={
                                        message.role === "user"
                                            ? "max-w-[85%] min-w-0 ml-auto"
                                            : "flex-1 min-w-0"
                                    }
                                >
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
            {/* 底部占位区域，确保最后一条消息不被输入框遮挡 */}
            <div className="h-32" />
            <div ref={messagesEndRef} />
        </div>
    )
}
