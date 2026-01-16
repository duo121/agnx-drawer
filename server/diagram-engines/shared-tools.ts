/**
 * Shared tools available to all diagram engines
 * These tools enable cross-engine functionality for the unified drawing agent
 */

import { z } from "zod"
import * as fs from "fs/promises"
import * as path from "path"

export function getSharedTools() {
    return {
        switch_canvas: {
            description: `Switch to a different canvas engine. Use this when:
1. User explicitly requests a specific canvas (e.g., "use Excalidraw", "switch to Draw.io")
2. The requested diagram type requires a specific engine (PlantUML → Draw.io, Mermaid → Excalidraw)
3. User wants hand-drawn style (→ Excalidraw) or professional diagrams with icons (→ Draw.io)

Available engines:
- drawio: Professional diagrams, rich icon libraries (AWS, Azure, GCP, K8s), PlantUML support
- excalidraw: Hand-drawn style, Mermaid support, whiteboard feel

After calling this tool, wait for the canvas to switch before generating diagram content.`,
            inputSchema: z.object({
                target: z
                    .enum(["drawio", "excalidraw"])
                    .describe("Target canvas engine to switch to"),
                reason: z
                    .string()
                    .describe("Brief explanation of why switching is needed (shown to user)"),
            }),
            // This is a client-side tool - the actual switching happens in the frontend
            // The tool result will be handled by the chat panel to trigger canvas switch
        },

        list_icon_libraries: {
            description: `List available icon libraries for the current canvas engine.
Use this when user asks about available icons, shapes, or wants to know what diagram types are supported.

For Draw.io: Returns cloud providers (AWS, Azure, GCP), networking (Cisco, K8s), business (BPMN), etc.
For Excalidraw: Returns basic shapes and flowchart elements (limited icon support).`,
            inputSchema: z.object({}),
            execute: async () => {
                // This will be enhanced based on current engine context
                return {
                    drawio: {
                        cloud: ["aws4", "azure2", "gcp2", "alibaba_cloud", "openstack"],
                        networking: ["cisco19", "kubernetes", "network", "vvd", "rack"],
                        business: ["bpmn", "lean_mapping"],
                        general: ["flowchart", "basic", "arrows2", "infographic", "sitemap"],
                        enterprise: ["citrix", "sap", "mscae", "atlassian"],
                        engineering: ["fluidpower", "electrical", "pid", "cabinets", "floorplan"],
                    },
                    excalidraw: {
                        basic: ["rectangle", "ellipse", "diamond", "arrow", "line", "text", "frame"],
                        styles: ["hand-drawn", "solid", "hachure", "cross-hatch"],
                    },
                    hint: "Use get_shape_library tool with a specific library name to see available shapes and syntax.",
                }
            },
        },

        read_skill_file: {
            description: `Read a skill file from the skills directory to learn specific diagram techniques.

Use this tool when you need to:
1. Learn syntax for a specific DSL (PlantUML, Mermaid)
2. Get detailed guidance for a diagram type (flowchart, architecture)
3. Look up icon library usage (AWS, Azure, GCP, K8s)

First read 'skills/_index.md' to discover available skills, then read specific SKILL.md files as needed.

Common paths:
- skills/_index.md - Directory index, start here
- skills/_engines/drawio/SKILL.md - Draw.io engine reference
- skills/_engines/excalidraw/SKILL.md - Excalidraw engine reference  
- skills/_dsl/plantuml/SKILL.md - PlantUML syntax
- skills/_dsl/mermaid/SKILL.md - Mermaid syntax
- skills/icons/aws/SKILL.md - AWS icons
- skills/flowchart/SKILL.md - Flowchart patterns`,
            inputSchema: z.object({
                filePath: z
                    .string()
                    .describe("Path to the skill file relative to skills directory, e.g., '_index.md' or '_dsl/plantuml/SKILL.md'"),
            }),
            execute: async ({ filePath }: { filePath: string }) => {
                try {
                    // Resolve the skills directory path
                    const skillsDir = path.resolve(process.cwd(), "skills")
                    const fullPath = path.join(skillsDir, filePath)
                    
                    // Security: ensure the path is within skills directory
                    const normalizedPath = path.normalize(fullPath)
                    if (!normalizedPath.startsWith(skillsDir)) {
                        return {
                            success: false,
                            error: "Access denied: Path must be within skills directory",
                        }
                    }
                    
                    // Read the file
                    const content = await fs.readFile(normalizedPath, "utf-8")
                    
                    return {
                        success: true,
                        path: filePath,
                        content,
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : "Unknown error"
                    return {
                        success: false,
                        error: `Failed to read skill file: ${errorMessage}`,
                        hint: "Try reading 'skills/_index.md' first to see available skills.",
                    }
                }
            },
        },
    }
}

/**
 * Merge shared tools with engine-specific tools
 */
export function mergeWithSharedTools(engineTools: Record<string, any>): Record<string, any> {
    return {
        ...getSharedTools(),
        ...engineTools,
    }
}
