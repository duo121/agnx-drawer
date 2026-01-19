/**
 * Unified Drawing Agent - System Prompt Builder
 *
 * 构建统一智能体的系统提示词，包含：
 * 1. 角色定义（固定）
 * 2. 场景感知与意图识别（固定）
 * 3. 共享工具说明（固定）
 * 4. 引擎专用提示词（根据 engineId 动态加载）
 * 5. 工作流程示例（固定）
 */

import * as fs from "fs"
import * as path from "path"
import type { CanvasType, UserIntent } from "../skills/intent-parser"

// ============================================================================
// Part 1: Role Definition (~100 tokens, fixed)
// ============================================================================
const ROLE_DEFINITION = `You are a professional diagram creation assistant, an AI agent specialized in creating visual diagrams through precise specifications.
You can see images that users upload, and you can read the text content extracted from PDF documents they upload.
You have access to multiple diagram engines and can switch between them based on user needs.`

// ============================================================================
// Part 2: Context Awareness & Intent Recognition (~200 tokens, fixed)
// ============================================================================
const CONTEXT_AWARENESS = `## App Context
You are inside a web-based diagram editor. The interface has:
- **Left panel**: Diagram canvas where diagrams are rendered
- **Right panel**: Chat interface where you communicate with the user

## Intent Recognition
Before creating or editing diagrams, analyze the user's request to determine:

1. **Canvas preference**: Does the user explicitly request a specific engine?
   - Draw.io keywords: "draw.io", "drawio", "professional", "icons", "PlantUML", "专业"
   - Excalidraw keywords: "excalidraw", "hand-drawn", "sketch", "whiteboard", "Mermaid", "手绘", "草图", "白板"

2. **DSL preference**: Is the user providing or requesting DSL code?
   - PlantUML: @startuml/@enduml, /plantuml, "用 PlantUML", "PlantUML 画" → requires Draw.io
   - Mermaid: flowchart TD, sequenceDiagram, /mermaid, "用 Mermaid", "Mermaid 画", "用mermaid" → requires Excalidraw

3. **Icon requirements**: Does the diagram need specific icon libraries?
   - Cloud: AWS, Azure, GCP keywords
   - Infrastructure: Kubernetes, network, Cisco keywords

**IMPORTANT**: If the current canvas doesn't match the requirement, you MUST call switch_canvas tool FIRST before generating any diagram content. The switch_canvas tool will wait until the new canvas is ready.`

// ============================================================================
// Part 3: Shared Tools (~150 tokens, fixed)
// ============================================================================
const SHARED_TOOLS_SECTION = `## Shared Tools (available on all engines)

### switch_canvas
Switch to a different diagram engine when needed.
- Use when: User requests specific engine, DSL requires specific engine, or diagram type is better suited for another engine
- Parameters: { target: "drawio" | "excalidraw", reason: string }
- After calling: Wait for canvas switch before generating content

### read_file
Read any file from the project. Use this to read documentation for icons, DSL syntax, etc.
- Common paths for Draw.io:
  - skills/drawio/shape-libraries/aws4.md - AWS icons
  - skills/drawio/shape-libraries/azure2.md - Azure icons
  - skills/drawio/shape-libraries/kubernetes.md - K8s icons
  - skills/drawio/dsl/plantuml.md - PlantUML syntax
- Common paths for Excalidraw:
  - skills/excalidraw/dsl/mermaid.md - Mermaid syntax
  - skills/excalidraw/flowchart.md - Flowchart patterns`

// ============================================================================
// Part 4: Engine Section (动态加载双引擎提示词)
// ============================================================================
// 加载两个引擎的 SKILL.md，让 AI 了解如何使用两种引擎

// ============================================================================
// Part 5: Workflow Examples (~100 tokens, fixed)
// ============================================================================
const WORKFLOW_EXAMPLES = `## Workflow Examples

### Example 1: User requests AWS architecture diagram (on Excalidraw)
1. Recognize "AWS" keyword → need Draw.io for icons
2. Call switch_canvas(target="drawio", reason="AWS icons require Draw.io")
3. Wait for canvas to be ready, then use display_drawio to create diagram

### Example 2: User says "用 Mermaid 画一个流程图" (on Draw.io)
1. Recognize "Mermaid" keyword → need Excalidraw
2. Call switch_canvas(target="excalidraw", reason="Mermaid requires Excalidraw")
3. Wait for canvas to be ready, then use convert_mermaid_to_excalidraw

### Example 3: User provides Mermaid code directly (on Draw.io)
1. Detect Mermaid syntax (flowchart TD, graph LR, sequenceDiagram, etc.)
2. Call switch_canvas(target="excalidraw", reason="Mermaid code detected")
3. Wait for canvas to be ready, then use convert_mermaid_to_excalidraw

### Example 4: User says "用 PlantUML 画时序图" (on Excalidraw)
1. Recognize "PlantUML" keyword → need Draw.io
2. Call switch_canvas(target="drawio", reason="PlantUML requires Draw.io")
3. Wait for canvas to be ready, then use convert_plantuml_to_drawio

### Example 5: User asks for AWS architecture diagram
1. Read icon documentation: read_file("skills/drawio/shape-libraries/aws4.md")
2. Learn the correct XML syntax for AWS icons
3. Generate diagram with proper icon styles`

// ============================================================================
// System Prompt Builder
// ============================================================================

interface BuildOptions {
    engineId: CanvasType
    modelId?: string
    minimalStyle?: boolean
    canvasTheme?: string
    userIntent?: UserIntent
}

/**
 * Load engine-specific SKILL.md content
 * 新结构：skills/{engineId}/SKILL.md
 */
function loadEngineSkill(engineId: CanvasType): string {
    const skillsDir = path.join(process.cwd(), "skills")
    const skillPath = path.join(skillsDir, engineId, "SKILL.md")

    try {
        const content = fs.readFileSync(skillPath, "utf-8")
        // Strip frontmatter
        const stripped = content.replace(/^---[\s\S]*?---\s*/, "")
        return stripped.trim()
    } catch (error) {
        console.warn(`[UnifiedAgent] Failed to load engine skill: ${skillPath}`)
        return ""
    }
}

/**
 * Build the unified agent system prompt
 * 双引擎会话：加载两个引擎的提示词，让 AI 了解如何使用两种引擎
 */
export function buildUnifiedSystemPrompt(options: BuildOptions): string {
    const { engineId, modelId, minimalStyle, canvasTheme, userIntent } = options

    const parts: string[] = []

    // Part 1: Role Definition
    parts.push(ROLE_DEFINITION)

    // Part 2: Context Awareness
    parts.push(CONTEXT_AWARENESS)

    // Part 3: Shared Tools
    parts.push(SHARED_TOOLS_SECTION)

    // Part 4: 双引擎提示词（加载两个引擎的 SKILL.md）
    const drawioSkill = loadEngineSkill("drawio")
    const excalidrawSkill = loadEngineSkill("excalidraw")
    
    // 用户当前活跃的引擎
    const currentEngineName = engineId === "drawio" ? "Draw.io" : "Excalidraw"
    parts.push(`## Current Active Engine: ${currentEngineName}\nThe user is currently viewing the ${currentEngineName} canvas. Tools for this engine will execute immediately.\nTo use tools for the other engine, call switch_canvas first to switch the view.`)
    
    // 加载两个引擎的详细提示词
    if (drawioSkill) {
        parts.push(`## Draw.io Engine Reference\n\n${drawioSkill}`)
    }
    if (excalidrawSkill) {
        parts.push(`## Excalidraw Engine Reference\n\n${excalidrawSkill}`)
    }

    // Part 5: Workflow Examples
    parts.push(WORKFLOW_EXAMPLES)

    // Add intent context if available
    if (userIntent) {
        const intentHints: string[] = []
        if (userIntent.dslPreference !== "none") {
            intentHints.push(`User is using ${userIntent.dslPreference.toUpperCase()} DSL`)
        }
        if (userIntent.requiredIconLibraries.length > 0) {
            intentHints.push(`Detected icon requirements: ${userIntent.requiredIconLibraries.join(", ")}`)
        }
        if (intentHints.length > 0) {
            parts.push(`## Current Request Context\n${intentHints.join("\n")}`)
        }
    }

    // Add minimal style instruction if enabled
    if (minimalStyle) {
        parts.unshift(`## ⚠️ MINIMAL STYLE MODE ACTIVE
- NO colors, NO fills - use only black/white
- Focus on layout and structure
- Skip styling attributes`)
    }

    // Join all parts
    let prompt = parts.join("\n\n")

    // Replace placeholders
    prompt = prompt.replace(/{{MODEL_NAME}}/g, modelId || "AI")

    // Handle Excalidraw text color based on theme
    if (engineId === "excalidraw" && canvasTheme) {
        const isDarkTheme = canvasTheme === "dark"
        const recommendedTextColor = isDarkTheme ? "#1e293b" : "#e2e8f0"
        prompt = prompt.replace(/{{TEXT_COLOR}}/g, recommendedTextColor)

        const textColorInstruction = isDarkTheme
            ? "For text elements, RECOMMENDED strokeColor is #1e293b (dark gray). Due to Excalidraw's color inversion in dark mode, this will render as light text."
            : "For text elements, RECOMMENDED strokeColor is #e2e8f0 (light gray) for readability on light canvas."
        prompt = prompt.replace(/{{TEXT_COLOR_INSTRUCTION}}/g, textColorInstruction)
    }

    return prompt
}

/**
 * Get the estimated token count for a prompt
 * (rough estimate: ~4 chars per token for English, ~2 chars for Chinese)
 */
export function estimateTokenCount(prompt: string): number {
    // Count ASCII and non-ASCII characters separately
    const asciiChars = prompt.replace(/[^\x00-\x7F]/g, "").length
    const nonAsciiChars = prompt.length - asciiChars

    // Rough estimation
    return Math.ceil(asciiChars / 4 + nonAsciiChars / 2)
}
