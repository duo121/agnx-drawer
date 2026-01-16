import {
    APICallError,
    convertToModelMessages,
    createUIMessageStream,
    createUIMessageStreamResponse,
    InvalidToolInputError,
    LoadAPIKeyError,
    stepCountIs,
    streamText,
} from "ai"
import { jsonrepair } from "jsonrepair"
import path from "path"
import {
    getAIModel,
    supportsImageInput,
    supportsPromptCaching,
} from "@/server/ai-providers"
import { findCachedResponse } from "@/server/cached-responses"
import {
    isMinimalDiagram,
    replaceHistoricalToolInputs,
    validateFileParts,
} from "@/server/chat-helpers"
import { getEngine } from "@/server/diagram-engines/registry"
import {
    checkAndIncrementRequest,
    isQuotaEnabled,
    recordTokenUsage,
} from "@/server/dynamo-quota-manager"
import {
    initSkillLoader,
    injectSkills,
    getBestSkillMatch,
    generateSkillGuide,
    parseUserIntent,
    needsCanvasSwitch,
    getSkillsToLoad,
    formatIntent,
    type EngineType,
    type CanvasType,
} from "@/server/skills"
import { buildUnifiedSystemPrompt } from "@/server/unified-agent"
import { getUserIdFromRequest } from "@/server/user-id"

// Initialize skill loader with skills directory
const skillsDir = path.join(process.cwd(), "skills")
const skillLoader = initSkillLoader(skillsDir)

export const maxDuration = 120

// Helper function to create cached stream response
function createCachedStreamResponse(xml: string): Response {
    const toolCallId = `cached-${Date.now()}`

    const stream = createUIMessageStream({
        execute: async ({ writer }) => {
            writer.write({ type: "start" })
            writer.write({
                type: "tool-input-start",
                toolCallId,
                toolName: "display_drawio",
            })
            writer.write({
                type: "tool-input-delta",
                toolCallId,
                inputTextDelta: xml,
            })
            writer.write({
                type: "tool-input-available",
                toolCallId,
                toolName: "display_drawio",
                input: { xml },
            })
            writer.write({ type: "finish" })
        },
    })

    return createUIMessageStreamResponse({ stream })
}

// Inner handler function
async function handleChatRequest(req: Request): Promise<Response> {
    // Check for access code
    const accessCodes =
        process.env.ACCESS_CODE_LIST?.split(",")
            .map((code) => code.trim())
            .filter(Boolean) || []
    if (accessCodes.length > 0) {
        const accessCodeHeader = req.headers.get("x-access-code")
        if (!accessCodeHeader || !accessCodes.includes(accessCodeHeader)) {
            return Response.json(
                {
                    error: "Invalid or missing access code. Please configure it in Settings.",
                },
                { status: 401 },
            )
        }
    }

    const {
        messages,
        xml,
        previousXml,
        sessionId,
        engineId: requestEngineId,
        currentState,
        previousState,
    } = await req.json()

    const engineId = requestEngineId || "drawio"
    const engine = getEngine(engineId)

    // Extract user input text early for skill matching
    const lastUserMessage = [...messages]
        .reverse()
        .find((m: any) => m.role === "user")
    const userInputText =
        lastUserMessage?.parts?.find((p: any) => p.type === "text")?.text || ""

    // Parse user intent for unified agent workflow
    const userIntent = parseUserIntent(userInputText, engineId as CanvasType)
    console.log(`[Intent] Parsed: ${formatIntent(userIntent)}`)

    // Check if canvas switch is needed
    const canvasSwitch = needsCanvasSwitch(userIntent, engineId as CanvasType)
    if (canvasSwitch.needed) {
        console.log(`[Intent] Canvas switch needed: ${engineId} → ${canvasSwitch.targetCanvas} (${canvasSwitch.reason})`)
        // Note: Actual canvas switching is handled by the switch_canvas tool
        // The AI will be informed about the need to switch via system prompt
    }

    // Check if user input is just a skill command (e.g., "/aws" with no other text)
    // If so, return a skill guide response instead of calling AI
    const skillCommandMatch = userInputText.trim().match(/^\/(\w+)\s*$/)
    if (skillCommandMatch) {
        const skillId = skillCommandMatch[1]
        const skill = skillLoader.loadSkill(skillId)
        if (skill) {
            console.log(`[Skills] Returning guide for skill "${skillId}"`)
            const guideText = generateSkillGuide(skill)

            // Return a streaming response with the guide text
            const stream = createUIMessageStream({
                execute: async ({ writer }) => {
                    writer.write({ type: "start" })
                    writer.write({
                        type: "text-delta",
                        delta: guideText,
                        id: `skill-guide-${skillId}`,
                    })
                    writer.write({ type: "finish" })
                },
            })
            return createUIMessageStreamResponse({ stream })
        }
    }

    // Load skills based on intent (auto-detection from keywords)
    const skillsToLoad = getSkillsToLoad(userIntent, engineId as CanvasType)
    console.log(`[Skills] Intent-based skills to load:`, skillsToLoad)

    // Load active skills from intent detection
    let activeSkills = skillsToLoad
        .map((id: string) => skillLoader.loadSkill(id))
        .filter((skill): skill is NonNullable<typeof skill> => skill !== null)

    // Log loaded skills
    activeSkills.forEach(skill => {
        console.log(`[Skills] Loaded skill "${skill.id}" from intent`)
    })

    // Fallback: If no skills from intent, try semantic matching
    if (activeSkills.length === 0 && userInputText) {
        const allSkills = skillLoader.listSkills()
        const bestMatch = getBestSkillMatch(allSkills, userInputText, engineId as EngineType, 3)
        if (bestMatch) {
            const autoSkill = skillLoader.loadSkill(bestMatch.skillId)
            if (autoSkill) {
                activeSkills = [autoSkill]
                console.log(`[Skills] Fallback: Auto-matched skill "${bestMatch.skillId}" (score: ${bestMatch.score}, ${bestMatch.reason})`)
            }
        }
    }
    console.log(`[Skills] Total active skills: ${activeSkills.length}`)

    const normalizedCurrentState = currentState ?? xml ?? ""
    const normalizedPreviousState = previousState ?? previousXml ?? ""

    // Get user ID for quota tracking
    const userId = getUserIdFromRequest(req)

    // === SERVER-SIDE QUOTA CHECK START ===
    // Quota is opt-in: only enabled when DYNAMODB_QUOTA_TABLE env var is set
    const hasOwnApiKey = !!(
        req.headers.get("x-ai-provider") && req.headers.get("x-ai-api-key")
    )

    // Skip quota check if: quota disabled, user has own API key, or is anonymous
    if (isQuotaEnabled() && !hasOwnApiKey && userId !== "anonymous") {
        const quotaCheck = await checkAndIncrementRequest(userId, {
            requests: Number(process.env.DAILY_REQUEST_LIMIT) || 10,
            tokens: Number(process.env.DAILY_TOKEN_LIMIT) || 200000,
            tpm: Number(process.env.TPM_LIMIT) || 20000,
        })
        if (!quotaCheck.allowed) {
            return Response.json(
                {
                    error: quotaCheck.error,
                    type: quotaCheck.type,
                    used: quotaCheck.used,
                    limit: quotaCheck.limit,
                },
                { status: 429 },
            )
        }
    }
    // === SERVER-SIDE QUOTA CHECK END ===

    // === FILE VALIDATION START ===
    const fileValidation = validateFileParts(messages)
    if (!fileValidation.valid) {
        return Response.json({ error: fileValidation.error }, { status: 400 })
    }
    // === FILE VALIDATION END ===

    // === CACHE CHECK START ===
    const isFirstMessage = messages.length === 1
    const isEmptyDiagram =
        !normalizedCurrentState ||
        normalizedCurrentState.trim() === "" ||
        isMinimalDiagram(normalizedCurrentState)

    if (isFirstMessage && isEmptyDiagram) {
        const lastMessage = messages[0]
        const textPart = lastMessage.parts?.find((p: any) => p.type === "text")
        const filePart = lastMessage.parts?.find((p: any) => p.type === "file")

        const cached = findCachedResponse(textPart?.text || "", !!filePart)

        if (cached) {
            return createCachedStreamResponse(cached.xml)
        }
    }
    // === CACHE CHECK END ===

    // Read client AI provider overrides from headers
    const provider = req.headers.get("x-ai-provider")
    let baseUrl = req.headers.get("x-ai-base-url")

    // For EdgeOne provider, construct full URL from request origin
    // because createOpenAI needs absolute URL, not relative path
    if (provider === "edgeone" && !baseUrl) {
        const origin = req.headers.get("origin") || new URL(req.url).origin
        baseUrl = `${origin}/api/edgeai`
    }

    // Get cookie header for EdgeOne authentication (eo_token, eo_time)
    const cookieHeader = req.headers.get("cookie")

    const clientOverrides = {
        provider,
        baseUrl,
        apiKey: req.headers.get("x-ai-api-key"),
        modelId: req.headers.get("x-ai-model"),
        // AWS Bedrock credentials
        awsAccessKeyId: req.headers.get("x-aws-access-key-id"),
        awsSecretAccessKey: req.headers.get("x-aws-secret-access-key"),
        awsRegion: req.headers.get("x-aws-region"),
        awsSessionToken: req.headers.get("x-aws-session-token"),
        // Pass cookies for EdgeOne Pages authentication
        ...(provider === "edgeone" &&
            cookieHeader && {
                headers: { cookie: cookieHeader },
            }),
    }

    // Read minimal style preference from header
    const minimalStyle = req.headers.get("x-minimal-style") === "true"
    // Read canvas theme from header (for Excalidraw)
    const canvasTheme = req.headers.get("x-canvas-theme") || "dark"

    // Get AI model with optional client overrides
    const { model, providerOptions, headers, modelId } =
        getAIModel(clientOverrides)

    // Check if model supports prompt caching
    const shouldCache = supportsPromptCaching(modelId)
    console.log(
        `[Prompt Caching] ${shouldCache ? "ENABLED" : "DISABLED"} for model: ${modelId}`,
    )

    // Build unified system prompt with dynamic engine loading
    // This replaces the old engine.getSystemPrompt + injectSkills flow
    const useUnifiedAgent = process.env.USE_UNIFIED_AGENT !== "false" // default enabled
    
    let systemMessage: string
    if (useUnifiedAgent) {
        // New unified agent approach: dynamic system prompt based on engineId
        systemMessage = buildUnifiedSystemPrompt({
            engineId: engineId as CanvasType,
            modelId,
            minimalStyle,
            canvasTheme,
            userIntent,
        })
        console.log(`[UnifiedAgent] Built system prompt for engine: ${engineId}`)
        
        // Still inject additional skills if detected (icon libraries, etc.)
        if (activeSkills.length > 0) {
            systemMessage = injectSkills(systemMessage, activeSkills)
            console.log(`[UnifiedAgent] Injected ${activeSkills.length} additional skills: ${activeSkills.map((s: any) => s.id).join(', ')}`)
        }
    } else {
        // Legacy approach: use engine-specific system prompt
        const baseSystemMessage = engine.getSystemPrompt(modelId, minimalStyle, canvasTheme)
        systemMessage = activeSkills.length > 0
            ? injectSkills(baseSystemMessage, activeSkills)
            : baseSystemMessage
        
        if (activeSkills.length > 0) {
            console.log(`[Skills] Injected ${activeSkills.length} skills: ${activeSkills.map((s: any) => s.id).join(', ')}`)
        }
    }

    // Extract file parts (images) from the last user message
    const fileParts =
        lastUserMessage?.parts?.filter((part: any) => part.type === "file") ||
        []

    // Check if user is sending images to a model that doesn't support them
    // AI SDK silently drops unsupported parts, so we need to catch this early
    if (fileParts.length > 0 && !supportsImageInput(modelId)) {
        return Response.json(
            {
                error: `The model "${modelId}" does not support image input. Please use a vision-capable model (e.g., GPT-4o, Claude, Gemini) or remove the image.`,
            },
            { status: 400 },
        )
    }

    // User input only - XML is now in a separate cached system message
    const formattedUserInput = `User input:
"""md
${userInputText}
"""`

    // Convert UIMessages to ModelMessages and add system message
    const modelMessages = await convertToModelMessages(messages)

    // === DASHSCOPE COMPATIBILITY START ===
    // DashScope requires strict message format and has non-standard tool_calls format
    // The custom fetch wrapper in ai-providers.ts handles the tool_calls format fix
    // Here we need to ensure tool messages immediately follow assistant messages with tool_calls
    console.log(`[route.ts] Provider detection: provider="${provider}", baseUrl="${baseUrl}", modelId="${modelId}"`)
    const isDashScope = provider === 'dashscope' || 
        (baseUrl?.includes('dashscope.aliyuncs.com') || baseUrl?.includes('dashscope'))
    console.log(`[route.ts] isDashScope: ${isDashScope}`)
    let compatibleMessages = modelMessages
    if (isDashScope) {
        console.log('[DashScope] Applying DashScope-compatible message format')
        console.log('[DashScope] Input messages:', modelMessages.map((m: any, i: number) => `${i}:${m.role}`))
        
        // Mark which messages to skip
        const skipIndices = new Set<number>()
        
        for (let i = 0; i < modelMessages.length; i++) {
            const msg = modelMessages[i]
            
            // Check for orphaned tool messages
            if (msg.role === 'tool') {
                // Look for the previous non-skipped message
                let foundValidPreceding = false
                for (let j = i - 1; j >= 0; j--) {
                    if (skipIndices.has(j)) continue
                    
                    const prevMsg = modelMessages[j]
                    if (prevMsg.role === 'assistant') {
                        const hasToolCalls = Array.isArray(prevMsg.content) &&
                            prevMsg.content.some((part: any) => part.type === 'tool-call')
                        if (hasToolCalls) {
                            foundValidPreceding = true
                        }
                    }
                    break
                }
                
                if (!foundValidPreceding) {
                    console.warn(`[DashScope] Skipping orphaned tool message at index ${i}`)
                    skipIndices.add(i)
                }
            }
        }
        
        // Filter out skipped messages
        compatibleMessages = modelMessages.filter((_, idx) => !skipIndices.has(idx))
        console.log(`[DashScope] Filtered messages: ${modelMessages.length} -> ${compatibleMessages.length}`)
        console.log('[DashScope] Output messages:', compatibleMessages.map((m: any, i: number) => `${i}:${m.role}`))
    }
    // === DASHSCOPE COMPATIBILITY END ===

    // DEBUG: Log incoming messages structure
    console.log("[route.ts] Incoming messages count:", messages.length)
    messages.forEach((msg: any, idx: number) => {
        console.log(
            `[route.ts] Message ${idx} role:`,
            msg.role,
            "parts count:",
            msg.parts?.length,
        )
        if (msg.parts) {
            msg.parts.forEach((part: any, partIdx: number) => {
                if (
                    part.type === "tool-invocation" ||
                    part.type === "tool-result"
                ) {
                    console.log(`[route.ts]   Part ${partIdx}:`, {
                        type: part.type,
                        toolName: part.toolName,
                        hasInput: !!part.input,
                        inputType: typeof part.input,
                        inputKeys:
                            part.input && typeof part.input === "object"
                                ? Object.keys(part.input)
                                : null,
                    })
                }
            })
        }
    })

    // Replace historical tool call XML with placeholders to reduce tokens
    // Disabled by default - some models (e.g. minimax) copy placeholders instead of generating XML
    const enableHistoryReplace =
        process.env.ENABLE_HISTORY_XML_REPLACE === "true"
    const placeholderMessages = enableHistoryReplace
        ? replaceHistoricalToolInputs(compatibleMessages)
        : compatibleMessages

    // Filter out messages with empty content arrays (Bedrock API rejects these)
    // This is a safety measure - ideally convertToModelMessages should handle all cases
    let enhancedMessages = placeholderMessages.filter(
        (msg: any) =>
            msg.content && Array.isArray(msg.content) && msg.content.length > 0,
    )

    // Filter out tool-calls with invalid inputs (from failed repair or interrupted streaming)
    // Bedrock API rejects messages where toolUse.input is not a valid JSON object
    enhancedMessages = enhancedMessages
        .map((msg: any) => {
            if (msg.role !== "assistant" || !Array.isArray(msg.content)) {
                return msg
            }
            const filteredContent = msg.content.filter((part: any) => {
                if (part.type === "tool-call") {
                    // Check if input is a valid object (not null, undefined, or empty)
                    if (
                        !part.input ||
                        typeof part.input !== "object" ||
                        Object.keys(part.input).length === 0
                    ) {
                        console.warn(
                            `[route.ts] Filtering out tool-call with invalid input:`,
                            { toolName: part.toolName, input: part.input },
                        )
                        return false
                    }
                }
                return true
            })
            return { ...msg, content: filteredContent }
        })
        .filter((msg: any) => msg.content && msg.content.length > 0)

    // DEBUG: Log modelMessages structure (what's being sent to AI)
    console.log("[route.ts] Model messages count:", enhancedMessages.length)
    enhancedMessages.forEach((msg: any, idx: number) => {
        console.log(
            `[route.ts] ModelMsg ${idx} role:`,
            msg.role,
            "content count:",
            msg.content?.length,
        )
        if (msg.content) {
            msg.content.forEach((part: any, partIdx: number) => {
                if (part.type === "tool-call" || part.type === "tool-result") {
                    console.log(`[route.ts]   Content ${partIdx}:`, {
                        type: part.type,
                        toolName: part.toolName,
                        hasInput: !!part.input,
                        inputType: typeof part.input,
                        inputValue:
                            part.input === undefined
                                ? "undefined"
                                : part.input === null
                                  ? "null"
                                  : "object",
                    })
                }
            })
        }
    })

    // Update the last message with user input only (XML moved to separate cached system message)
    if (enhancedMessages.length >= 1) {
        const lastModelMessage = enhancedMessages[enhancedMessages.length - 1]
        if (lastModelMessage.role === "user") {
            // Build content array with user input text and file parts
            const contentParts: any[] = [
                { type: "text", text: formattedUserInput },
            ]

            // Add image parts back
            for (const filePart of fileParts) {
                contentParts.push({
                    type: "image",
                    image: filePart.url,
                    mimeType: filePart.mediaType,
                })
            }

            enhancedMessages = [
                ...enhancedMessages.slice(0, -1),
                { ...lastModelMessage, content: contentParts },
            ]
        }
    }

    // Add cache point to the last assistant message in conversation history
    // This caches the entire conversation prefix for subsequent requests
    // Strategy: system (cached) + history with last assistant (cached) + new user message
    if (shouldCache && enhancedMessages.length >= 2) {
        // Find the last assistant message (should be second-to-last, before current user message)
        for (let i = enhancedMessages.length - 2; i >= 0; i--) {
            if (enhancedMessages[i].role === "assistant") {
                enhancedMessages[i] = {
                    ...enhancedMessages[i],
                    providerOptions: {
                        bedrock: { cachePoint: { type: "default" } },
                    },
                }
                break // Only cache the last assistant message
            }
        }
    }

    // System messages with multiple cache breakpoints for optimal caching:
    // - Breakpoint 1: Static instructions (~1500 tokens) - rarely changes
    // - Breakpoint 2: Current XML context - changes per diagram, but constant within a conversation turn
    // This allows: if only user message changes, both system caches are reused
    //              if XML changes, instruction cache is still reused
    const systemMessages = [
        // Cache breakpoint 1: Instructions (rarely change)
        {
            role: "system" as const,
            content: systemMessage,
            ...(shouldCache && {
                providerOptions: {
                    bedrock: { cachePoint: { type: "default" } },
                },
            }),
        },
        // Cache breakpoint 2: Previous and Current diagram XML context
        {
            role: "system" as const,
            content: `${normalizedPreviousState ? `Previous ${engine.name} ${engine.dataFormat} (before user's last message):\n"""${engine.dataFormat}\n${normalizedPreviousState}\n"""\n\n` : ""}Current ${engine.name} ${engine.dataFormat} (AUTHORITATIVE - the source of truth):\n"""${engine.dataFormat}\n${normalizedCurrentState || ""}\n"""\n\nIMPORTANT: The \"Current\" state is the SINGLE SOURCE OF TRUTH for what's on the canvas right now. The user can manually add, delete, or modify shapes directly in the editor. Always count and describe elements based on the CURRENT state, not on what you previously generated. If both previous and current state are shown, compare them to understand what the user changed. When using edit_drawio, COPY search patterns exactly from the CURRENT state - attribute order matters!`,
            ...(shouldCache && {
                providerOptions: {
                    bedrock: { cachePoint: { type: "default" } },
                },
            }),
        },
    ]

    const allMessages = [...systemMessages, ...enhancedMessages]

    const result = streamText({
        model,
        ...(process.env.MAX_OUTPUT_TOKENS && {
            maxOutputTokens: parseInt(process.env.MAX_OUTPUT_TOKENS, 10),
        }),
        stopWhen: stepCountIs(5),
        // Repair truncated tool calls when maxOutputTokens is reached mid-JSON
        experimental_repairToolCall: async ({ toolCall, error }) => {
            // DEBUG: Log what we're trying to repair
            console.log(`[repairToolCall] Tool: ${toolCall.toolName}`)
            console.log(
                `[repairToolCall] Error: ${error.name} - ${error.message}`,
            )
            console.log(`[repairToolCall] Input type: ${typeof toolCall.input}`)
            console.log(`[repairToolCall] Input value:`, toolCall.input)

            // Only attempt repair for invalid tool input (broken JSON from truncation)
            if (
                error instanceof InvalidToolInputError ||
                error.name === "AI_InvalidToolInputError"
            ) {
                try {
                    // Pre-process to fix common LLM JSON errors that jsonrepair can't handle
                    let inputToRepair = toolCall.input
                    if (typeof inputToRepair === "string") {
                        // Fix `:=` instead of `: ` (LLM sometimes generates this)
                        inputToRepair = inputToRepair.replace(/:=/g, ": ")
                        // Fix `= "` instead of `: "`
                        inputToRepair = inputToRepair.replace(/=\s*"/g, ': "')
                    }
                    // Use jsonrepair to fix truncated JSON
                    const repairedInput = jsonrepair(inputToRepair)
                    console.log(
                        `[repairToolCall] Repaired truncated JSON for tool: ${toolCall.toolName}`,
                    )
                    return { ...toolCall, input: repairedInput }
                } catch (repairError) {
                    console.warn(
                        `[repairToolCall] Failed to repair JSON for tool: ${toolCall.toolName}`,
                        repairError,
                    )
                    // Return a placeholder input to avoid API errors in multi-step
                    // The tool will fail gracefully on client side
                    if (toolCall.toolName === "edit_drawio") {
                        return {
                            ...toolCall,
                            input: {
                                operations: [],
                                _error: "JSON repair failed - no operations to apply",
                            },
                        }
                    }
                    if (toolCall.toolName === "display_drawio") {
                        return {
                            ...toolCall,
                            input: {
                                xml: "",
                                _error: "JSON repair failed - empty diagram",
                            },
                        }
                    }
                    return null
                }
            }
            // Don't attempt to repair other errors (like NoSuchToolError)
            return null
        },
        messages: allMessages,
        ...(providerOptions && { providerOptions }), // This now includes all reasoning configs
        ...(headers && { headers }),
        onFinish: ({ text, totalUsage }) => {

            // Record token usage for server-side quota tracking (if enabled)
            // Use totalUsage (cumulative across all steps) instead of usage (final step only)
            // Include all 4 token types: input, output, cache read, cache write
            if (
                isQuotaEnabled() &&
                !hasOwnApiKey &&
                userId !== "anonymous" &&
                totalUsage
            ) {
                const totalTokens =
                    (totalUsage.inputTokens || 0) +
                    (totalUsage.outputTokens || 0) +
                    (totalUsage.cachedInputTokens || 0) +
                    (totalUsage.inputTokenDetails?.cacheWriteTokens || 0)
                recordTokenUsage(userId, totalTokens)
            }
        },
        tools: engine.getTools(),
        ...(process.env.TEMPERATURE !== undefined && {
            temperature: parseFloat(process.env.TEMPERATURE),
        }),
    })

    return result.toUIMessageStreamResponse({
        sendReasoning: true,
        messageMetadata: ({ part }) => {
            if (part.type === "finish") {
                const usage = (part as any).totalUsage
                // AI SDK 6 provides totalTokens directly
                return {
                    totalTokens: usage?.totalTokens ?? 0,
                    finishReason: (part as any).finishReason,
                }
            }
            return undefined
        },
    })
}

// Helper to categorize errors and return appropriate response
function handleError(error: unknown): Response {
    console.error("Error in chat route:", error)

    const isDev = process.env.NODE_ENV === "development"

    // Check for specific AI SDK error types
    if (APICallError.isInstance(error)) {
        return Response.json(
            {
                error: error.message,
                ...(isDev && {
                    details: error.responseBody,
                    stack: error.stack,
                }),
            },
            { status: error.statusCode || 500 },
        )
    }

    if (LoadAPIKeyError.isInstance(error)) {
        return Response.json(
            {
                error: "Authentication failed. Please check your API key.",
                ...(isDev && {
                    stack: error.stack,
                }),
            },
            { status: 401 },
        )
    }

    // Fallback for other errors with safety filter
    const message =
        error instanceof Error ? error.message : "An unexpected error occurred"
    const status = (error as any)?.statusCode || (error as any)?.status || 500

    // Prevent leaking API keys, tokens, or other sensitive data
    const lowerMessage = message.toLowerCase()
    const safeMessage =
        lowerMessage.includes("key") ||
        lowerMessage.includes("token") ||
        lowerMessage.includes("sig") ||
        lowerMessage.includes("signature") ||
        lowerMessage.includes("secret") ||
        lowerMessage.includes("password") ||
        lowerMessage.includes("credential")
            ? "Authentication failed. Please check your credentials."
            : message

    return Response.json(
        {
            error: safeMessage,
            ...(isDev && {
                details: message,
                stack: error instanceof Error ? error.stack : undefined,
            }),
        },
        { status },
    )
}

// Wrap handler with error handling
async function safeHandler(req: Request): Promise<Response> {
    try {
        return await handleChatRequest(req)
    } catch (error) {
        return handleError(error)
    }
}

export async function POST(req: Request) {
    return safeHandler(req)
}
