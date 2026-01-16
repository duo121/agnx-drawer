import { deflateRawSync } from "zlib"

const C4_TYPES = new Set([
    "Person",
    "Person_Ext",
    "System",
    "SystemDb",
    "SystemQueue",
    "System_Ext",
    "SystemDb_Ext",
    "SystemQueue_Ext",
    "Container",
    "ContainerDb",
    "ContainerQueue",
    "Container_Ext",
    "ContainerDb_Ext",
    "ContainerQueue_Ext",
    "Component",
    "ComponentDb",
    "ComponentQueue",
    "Component_Ext",
    "ComponentDb_Ext",
    "ComponentQueue_Ext",
])

export interface C4Entity {
    alias: string
    label: string
    type: string
    technology?: string
    description?: string
    parent?: string
    children?: C4Entity[]
}

export interface C4Relation {
    source: string
    target: string
    label: string
    description: string
}

export interface C4ConvertOptions {
    compressed?: boolean
}

interface PositionedEntity {
    entity: C4Entity
    x: number
    y: number
    width: number
    height: number
}

interface LayoutResult {
    nodes: PositionedEntity[]
}

const TYPE_DIMENSIONS: Record<string, { width: number; height: number }> = {
    System: { width: 220, height: 140 },
    Container: { width: 200, height: 120 },
    Component: { width: 180, height: 100 },
}

function isSkippableLine(line: string): boolean {
    return (
        line.length === 0 ||
        line.startsWith("!include") ||
        line.startsWith("@start") ||
        line.startsWith("@end") ||
        /^'(.*)/.test(line) ||
        line.startsWith("LAYOUT_") ||
        line.startsWith("SHOW_LEGEND") ||
        line.startsWith("title") ||
        line.startsWith("scale") ||
        line.startsWith("Update") ||
        line.startsWith("AddRelTag") ||
        line.startsWith("AddElementTag") ||
        line.startsWith("Rel(")
    )
}

function parseBlock(parent: string | undefined, block: string): C4Entity | null {
    const matchNode = /^(.*)\((.*)\)/
    const matched = block.match(matchNode)
    const props = matched?.[2]?.split(",").map((prop) => prop.trim())
    const type = matched?.[1]

    if (!props || !type || !C4_TYPES.has(type)) {
        return null
    }

    const result: C4Entity = {
        parent,
        type,
        alias: props[0],
        label: props[1],
    }

    const textProps = props.filter((prop) => !prop.startsWith("$"))
    if (textProps.length >= 3) {
        result.technology = textProps[2]
    }
    if (textProps.length >= 4) {
        result.description = textProps[3]
    }

    return result
}

export function parseC4Entities(input: string): C4Entity[] {
    const lines = input
        .split("\n")
        .map((block) => block.trim().replaceAll('"', ""))
        .filter((line) => !isSkippableLine(line))

    const result: C4Entity[] = []
    const stack: string[] = []

    for (const line of lines) {
        if (line.endsWith("{")) {
            const parent = stack[stack.length - 1]
            const parsed = parseBlock(parent, line)
            if (parsed) {
                result.push(parsed)
                stack.push(parsed.alias)
            }
            continue
        }

        if (line.startsWith("}")) {
            stack.pop()
            continue
        }

        const parent = stack[stack.length - 1]
        const parsed = parseBlock(parent, line)
        if (parsed) {
            result.push(parsed)
        }
    }

    return createHierarchy(result)
}

function createHierarchy(systems: C4Entity[]): C4Entity[] {
    const result: C4Entity[] = []

    for (const system of systems) {
        if (!system.parent) {
            delete system.parent
            result.push(system)
        } else {
            const parent = systems.find((s) => s.alias === system.parent)
            if (parent) {
                if (!parent.children) {
                    parent.children = []
                }
                delete system.parent
                parent.children.push(system)
            }
        }
    }

    return result
}

export function parseC4Relations(pumlString: string): C4Relation[] {
    const relations: C4Relation[] = []
    const relationPattern = /Rel\(([^,]+),\s*([^,]+),\s*"([^"]+)",\s*"([^"]+)"\)/g

    let match: RegExpExecArray | null
    while ((match = relationPattern.exec(pumlString)) !== null) {
        relations.push({
            source: match[1].trim(),
            target: match[2].trim(),
            label: match[3].trim(),
            description: match[4].trim(),
        })
    }

    return relations
}

function flattenEntities(entities: C4Entity[], depth = 0): Array<C4Entity & { depth: number }> {
    const result: Array<C4Entity & { depth: number }> = []
    for (const entity of entities) {
        result.push({ ...entity, depth })
        if (entity.children?.length) {
            result.push(...flattenEntities(entity.children, depth + 1))
        }
    }
    return result
}

function layoutEntities(entities: C4Entity[]): LayoutResult {
    const flat = flattenEntities(entities)
    const depthBuckets = new Map<number, Array<C4Entity & { depth: number }>>()
    flat.forEach((item) => {
        const list = depthBuckets.get(item.depth) || []
        list.push(item)
        depthBuckets.set(item.depth, list)
    })

    const nodes: PositionedEntity[] = []
    const spacingX = 260
    const spacingY = 200
    const startX = 40
    const startY = 40

    Array.from(depthBuckets.keys())
        .sort((a, b) => a - b)
        .forEach((depth) => {
            const level = depthBuckets.get(depth) || []
            level.forEach((entity, index) => {
                const dims = TYPE_DIMENSIONS[entity.type] || { width: 160, height: 90 }
                nodes.push({
                    entity,
                    width: dims.width,
                    height: dims.height,
                    x: startX + index * spacingX,
                    y: startY + depth * spacingY,
                })
            })
        })

    return { nodes }
}

function generateIdPrefix(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    let result = ""
    for (let i = 0; i < 20; i += 1) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}

function wrapInDrawioFormat(content: string, compressed = false): string {
    const timestamp = new Date().toISOString()
    const cleanContent = content.replace(/\n\s*/g, "").trim()
    const mxGraphModel = `<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="826" background="none" math="0" shadow="0"><root><mxCell id="0" /><mxCell id="1" parent="0" />${cleanContent}</root></mxGraphModel>`

    if (compressed) {
        try {
            const compressedBuffer = deflateRawSync(Buffer.from(mxGraphModel, "utf-8"))
            const encoded = compressedBuffer.toString("base64")
            return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${timestamp}" agent="Mozilla/5.0" etag="plantuml2drawio" version="21.6.5" type="device">
  <diagram id="diagram-1" name="Page-1">${encoded}</diagram>
</mxfile>`
        } catch {
            // fall through to uncompressed output
        }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${timestamp}" agent="Mozilla/5.0" etag="plantuml2drawio" version="21.6.5" type="device">
  <diagram id="diagram-1" name="Page-1">
    ${mxGraphModel}
  </diagram>
</mxfile>`
}

function buildC4Xml(layout: LayoutResult, relations: C4Relation[]): string {
    const prefix = generateIdPrefix()
    let cellId = 2
    const nextId = () => `${prefix}-${cellId++}`
    const nodeMap = new Map<string, string>()
    let xml = ""

    layout.nodes.forEach((node) => {
        const id = nextId()
        nodeMap.set(node.entity.alias, id)
        const { x, y, width, height } = node
        const valueParts = [node.entity.label, node.entity.technology, node.entity.description].filter(Boolean)
        const value = valueParts.join(" | ")
        const fill =
            node.entity.type.startsWith("System") ? "#d5e8d4" : node.entity.type.startsWith("Container") ? "#dae8fc" : "#fff2cc"
        const stroke =
            node.entity.type.startsWith("System") ? "#82b366" : node.entity.type.startsWith("Container") ? "#6c8ebf" : "#d6b656"
        xml += `<mxCell id="${id}" value="${value}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry" /></mxCell>`
    })

    relations.forEach((rel) => {
        const sourceId = nodeMap.get(rel.source)
        const targetId = nodeMap.get(rel.target)
        if (!sourceId || !targetId) return
        const id = nextId()
        const label = [rel.label, rel.description].filter(Boolean).join(" - ")
        xml += `<mxCell id="${id}" value="${label}" style="endArrow=block;endSize=12;html=1;rounded=0;" edge="1" parent="1" source="${sourceId}" target="${targetId}"><mxGeometry relative="1" as="geometry"/></mxCell>`
    })

    return xml
}

export function detectC4(code: string): boolean {
    const c4Patterns = [
        /!include.*C4/i,
        /System\s*\(/,
        /Container\s*\(/,
        /Component\s*\(/,
        /System_Ext\s*\(/,
        /Container_Ext\s*\(/,
        /Rel\s*\(/,
    ]
    return c4Patterns.some((pattern) => pattern.test(code))
}

export async function convertC4ToDrawio(code: string, options: C4ConvertOptions = {}): Promise<string> {
    const entities = parseC4Entities(code)
    const relations = parseC4Relations(code)
    const layout = layoutEntities(entities)
    const xml = buildC4Xml(layout, relations)
    return wrapInDrawioFormat(xml, Boolean(options.compressed))
}
