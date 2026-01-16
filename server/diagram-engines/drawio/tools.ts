import fs from "fs/promises"
import path from "path"
import { z } from "zod"
import {
    convertPlantUMLToDrawio,
    encodePlantUML,
} from "@/shared/script-convertor"

export function getDrawioTools() {
    return {
        // Client-side tool: handled on the client to render diagrams
        display_drawio: {
            description: `Display a diagram on draw.io. Pass ONLY the mxCell elements - wrapper tags and root cells are added automatically.

VALIDATION RULES (XML will be rejected if violated):
1. Generate ONLY mxCell elements - NO wrapper tags (<mxfile>, <mxGraphModel>, <root>)
2. Do NOT include root cells (id="0" or id="1") - they are added automatically
3. All mxCell elements must be siblings - never nested
4. Every mxCell needs a unique id (start from "2")
5. Every mxCell needs a valid parent attribute (use "1" for top-level)
6. Escape special chars in values: &lt; &gt; &amp; &quot;

Example (generate ONLY this - no wrapper tags):
<mxCell id="lane1" value="Frontend" style="swimlane;" vertex="1" parent="1">
  <mxGeometry x="40" y="40" width="200" height="200" as="geometry"/>
</mxCell>
<mxCell id="step1" value="Step 1" style="rounded=1;" vertex="1" parent="lane1">
  <mxGeometry x="20" y="60" width="160" height="40" as="geometry"/>
</mxCell>
<mxCell id="lane2" value="Backend" style="swimlane;" vertex="1" parent="1">
  <mxGeometry x="280" y="40" width="200" height="200" as="geometry"/>
</mxCell>
<mxCell id="step2" value="Step 2" style="rounded=1;" vertex="1" parent="lane2">
  <mxGeometry x="20" y="60" width="160" height="40" as="geometry"/>
</mxCell>
<mxCell id="edge1" style="edgeStyle=orthogonalEdgeStyle;endArrow=classic;" edge="1" parent="1" source="step1" target="step2">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>

Notes:
- For AWS diagrams, use **AWS 2025 icons**.
- For animated connectors, add "flowAnimation=1" to edge style.
`,
            inputSchema: z.object({
                xml: z.string().describe("XML string to be displayed on draw.io"),
            }),
        },
        convert_plantuml_to_drawio: {
            description: `Convert PlantUML code to Draw.io XML.

When autoInsert=true (default): Converts and inserts directly into canvas.
When autoInsert=false: Returns XML for AI to review/enhance before calling edit_drawio.

Use autoInsert=false for complex requests that need:
- Icon library enhancement (e.g., replacing shapes with AWS/Android icons)
- Layout adjustments
- Style customization`,
            inputSchema: z.object({
                code: z.string().describe("PlantUML DSL code to convert"),
                autoInsert: z
                    .boolean()
                    .optional()
                    .default(true)
                    .describe(
                        "If true (default), insert directly into canvas. If false, return XML for AI to review/enhance before calling edit_diagram.",
                    ),
            }),
            execute: async ({ code, autoInsert = true }: { code: string; autoInsert?: boolean }) => {
                const xml = await convertPlantUMLToDrawio(code)
                const pngUrl = await encodePlantUML(code, { format: "png" })
                const svgUrl = await encodePlantUML(code, { format: "svg" })
                return {
                    xml,
                    pngUrl,
                    svgUrl,
                    code,
                    autoInsert,
                    insertedIds: [], // 暂无精确新增 ID，客户端可全选
                    message: autoInsert
                        ? "PlantUML converted and ready to insert."
                        : "Conversion complete. Review the XML and call edit_drawio to insert with modifications.",
                }
            },
        },
        edit_drawio: {
            description: `Edit the current Draw.io diagram by ID-based operations (update/add/delete cells).

Operations:
- update: Replace an existing cell by its id. Provide cell_id and complete new_xml.
- add: Add a new cell. Provide cell_id (new unique id) and new_xml.
- delete: Remove a cell. Cascade is automatic: children AND edges (source/target) are auto-deleted. Only specify ONE cell_id.

For update/add, new_xml must be a complete mxCell element including mxGeometry.

⚠️ JSON ESCAPING: Every " inside new_xml MUST be escaped as \\". Example: id=\\"5\\" value=\\"Label\\"

Example - Add a rectangle:
{"operations": [{"operation": "add", "cell_id": "rect-1", "new_xml": "<mxCell id=\\"rect-1\\" value=\\"Hello\\" style=\\"rounded=0;\\" vertex=\\"1\\" parent=\\"1\\"><mxGeometry x=\\"100\\" y=\\"100\\" width=\\"120\\" height=\\"60\\" as=\\"geometry\\"/></mxCell>"}]}

Example - Delete container (children & edges auto-deleted):
{"operations": [{"operation": "delete", "cell_id": "2"}]}`,
            inputSchema: z.object({
                operations: z
                    .array(
                        z.object({
                            operation: z
                                .enum(["update", "add", "delete"])
                                .describe("Operation to perform: add, update, or delete"),
                            cell_id: z
                                .string()
                                .describe("The id of the mxCell. Must match the id attribute in new_xml."),
                            new_xml: z
                                .string()
                                .optional()
                                .describe("Complete mxCell XML element (required for update/add)"),
                        }),
                    )
                    .describe("Array of operations to apply"),
            }),
        },
        append_drawio: {
            description: `Continue generating Draw.io XML when previous display_drawio output was truncated due to length limits.

WHEN TO USE: Only call this tool after display_drawio was truncated (you'll see an error message about truncation).

CRITICAL INSTRUCTIONS:
1. Do NOT include any wrapper tags - just continue the mxCell elements
2. Continue from EXACTLY where your previous output stopped
3. Complete the remaining mxCell elements
4. If still truncated, call append_diagram again with the next fragment

Example: If previous output ended with '<mxCell id="x" style="rounded=1', continue with ';" vertex="1">...' and complete the remaining elements.`,
            inputSchema: z.object({
                xml: z
                    .string()
                    .describe("Continuation XML fragment to append (NO wrapper tags)"),
            }),
        },
        get_shape_library: {
            description: `Get draw.io shape/icon library documentation with style syntax and shape names.

Available libraries:
- Cloud: aws4, azure2, gcp2, alibaba_cloud, openstack, salesforce
- Networking: cisco19, network, kubernetes, vvd, rack
- Business: bpmn, lean_mapping
- General: flowchart, basic, arrows2, infographic, sitemap
- UI/Mockups: android
- Enterprise: citrix, sap, mscae, atlassian
- Engineering: fluidpower, electrical, pid, cabinets, floorplan
- Icons: webicons

Call this tool to get shape names and usage syntax for a specific library.`,
            inputSchema: z.object({
                library: z
                    .string()
                    .describe("Library name (e.g., 'aws4', 'kubernetes', 'flowchart')"),
            }),
            execute: async ({ library }: { library: string }) => {
                // Sanitize input - prevent path traversal attacks
                const sanitizedLibrary = library.toLowerCase().replace(/[^a-z0-9_-]/g, "")

                if (sanitizedLibrary !== library.toLowerCase()) {
                    return `Invalid library name "${library}". Use only letters, numbers, underscores, and hyphens.`
                }

                const baseDir = path.join(process.cwd(), "docs/shape-libraries")
                const filePath = path.join(baseDir, `${sanitizedLibrary}.md`)

                // Verify path stays within expected directory
                const resolvedPath = path.resolve(filePath)
                if (!resolvedPath.startsWith(path.resolve(baseDir))) {
                    return `Invalid library path.`
                }

                try {
                    const content = await fs.readFile(filePath, "utf-8")
                    return content
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                        return `Library "${library}" not found. Available: aws4, azure2, gcp2, alibaba_cloud, cisco19, kubernetes, network, bpmn, flowchart, basic, arrows2, vvd, salesforce, citrix, sap, mscae, atlassian, fluidpower, electrical, pid, cabinets, floorplan, webicons, infographic, sitemap, android, lean_mapping, openstack, rack`
                    }
                    console.error(`[get_shape_library] Error loading "${library}":`, error)
                    return `Error loading library "${library}". Please try again.`
                }
            },
        },
    }
}
