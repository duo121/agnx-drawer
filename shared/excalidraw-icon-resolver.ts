/**
 * Excalidraw Icon Resolver
 * 
 * Resolves $icon placeholders in Excalidraw elements array.
 * Icons are loaded from public/icons/{category}/{name}.json
 */

import { nanoid } from "nanoid"

interface IconPlaceholder {
    $icon: string  // e.g., "aws/lambda"
    x: number
    y: number
    scale?: number
}

interface IconData {
    name: string
    width: number
    height: number
    elements: any[]
}

// Cache for loaded icons
const iconCache = new Map<string, IconData>()

/**
 * Check if an element is an $icon placeholder
 */
export function isIconPlaceholder(element: any): element is IconPlaceholder {
    return element && typeof element === "object" && typeof element.$icon === "string"
}

/**
 * Load icon data from JSON file
 */
async function loadIcon(iconPath: string): Promise<IconData | null> {
    // Check cache first
    if (iconCache.has(iconPath)) {
        return iconCache.get(iconPath)!
    }

    try {
        // Load from public/icons/{category}/{name}.json
        const response = await fetch(`/icons/${iconPath}.json`)
        if (!response.ok) {
            console.warn(`[IconResolver] Icon not found: ${iconPath}`)
            return null
        }
        const data: IconData = await response.json()
        iconCache.set(iconPath, data)
        return data
    } catch (error) {
        console.error(`[IconResolver] Failed to load icon ${iconPath}:`, error)
        return null
    }
}

/**
 * Expand a single $icon placeholder into Excalidraw elements
 */
async function expandIconPlaceholder(placeholder: IconPlaceholder): Promise<any[]> {
    const { $icon, x, y, scale = 1 } = placeholder
    
    const iconData = await loadIcon($icon)
    if (!iconData) {
        // Return a fallback rectangle with label if icon not found
        const fallbackId = nanoid()
        return [
            {
                type: "rectangle",
                id: fallbackId,
                x,
                y,
                width: 80,
                height: 60,
                strokeColor: "#e11d48",
                backgroundColor: "#fecdd3",
                fillStyle: "solid",
                strokeWidth: 2,
                roughness: 0,
                roundness: { type: 2 },
                boundElements: [{ id: `${fallbackId}-label`, type: "text" }],
            },
            {
                type: "text",
                id: `${fallbackId}-label`,
                x: 0,
                y: 0,
                text: $icon.split("/").pop() || "?",
                fontSize: 14,
                fontFamily: 2,
                textAlign: "center",
                verticalAlign: "middle",
                containerId: fallbackId,
            },
        ]
    }

    // Clone and transform icon elements
    const groupId = nanoid()
    return iconData.elements.map((el: any) => {
        const newId = nanoid()
        const transformed = {
            ...el,
            id: newId,
            x: (el.x || 0) * scale + x,
            y: (el.y || 0) * scale + y,
            groupIds: [...(el.groupIds || []), groupId],
        }
        
        // Scale dimensions if present
        if (el.width) transformed.width = el.width * scale
        if (el.height) transformed.height = el.height * scale
        
        // Handle text containerId - will be fixed in post-processing
        if (el.containerId) {
            transformed._originalContainerId = el.containerId
        }
        
        return transformed
    })
}

/**
 * Resolve all $icon placeholders in an elements array
 * 
 * @param elements - Mixed array of Excalidraw elements and $icon placeholders
 * @returns Array of pure Excalidraw elements with icons expanded
 */
export async function resolveIconPlaceholders(elements: any[]): Promise<any[]> {
    const result: any[] = []
    
    for (const element of elements) {
        if (isIconPlaceholder(element)) {
            const expandedElements = await expandIconPlaceholder(element)
            result.push(...expandedElements)
        } else {
            result.push(element)
        }
    }
    
    return result
}

/**
 * Check if elements array contains any $icon placeholders
 */
export function hasIconPlaceholders(elements: any[]): boolean {
    return elements.some(isIconPlaceholder)
}
