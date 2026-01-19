"use client"

import { CodeBlock } from "@/components/code-block"
import type { ToolContentRendererProps } from "../types"

/**
 * 默认工具内容渲染器
 * 将 input 显示为 JSON 格式
 */
export function DefaultRenderer({ part }: ToolContentRendererProps) {
    const { input } = part
    
    if (!input || typeof input !== "object" || Object.keys(input).length === 0) {
        return null
    }
    
    return <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
}
