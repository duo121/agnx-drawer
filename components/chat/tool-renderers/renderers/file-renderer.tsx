"use client"

import { Check, FileEdit, XCircle } from "lucide-react"
import type { ToolContentRendererProps } from "../types"

/**
 * 文件工具内容渲染器
 * 用于 read_file 和 write_file 工具
 */
export function FileRenderer({ part, toolName }: ToolContentRendererProps) {
    const { state, output } = part
    
    // 只在完成时显示结果
    if (state !== "output-available") {
        return null
    }
    
    if (toolName === "read_file") {
        return <ReadFileResult output={output} />
    }
    
    if (toolName === "write_file") {
        return <WriteFileResult output={output} />
    }
    
    return null
}

interface ReadFileResultProps {
    output: unknown
}

function ReadFileResult({ output }: ReadFileResultProps) {
    const fileResult = output as {
        success?: boolean
        path?: string
        content?: string
        lineCount?: number
        error?: string
    } | null
    
    if (fileResult?.success) {
        return (
            <>
                <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                    <Check className="w-3 h-3 text-green-600" />
                    <span>{fileResult.path}</span>
                    <span className="text-muted-foreground/60">
                        ({fileResult.lineCount} lines)
                    </span>
                </div>
                <pre className="text-xs bg-muted/50 p-2 rounded-md overflow-auto max-h-40 whitespace-pre-wrap font-mono">
                    {fileResult.content?.substring(0, 1500)}
                    {(fileResult.content?.length || 0) > 1500 && "\n..."}
                </pre>
            </>
        )
    }
    
    return (
        <div className="text-xs text-red-600 flex items-center gap-2">
            <XCircle className="w-3 h-3" />
            <span>{fileResult?.error || "Failed to read file"}</span>
        </div>
    )
}

interface WriteFileResultProps {
    output: unknown
}

function WriteFileResult({ output }: WriteFileResultProps) {
    const writeResult = output as {
        success?: boolean
        path?: string
        bytesWritten?: number
        mode?: string
        error?: string
    } | null
    
    if (writeResult?.success) {
        return (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
                <FileEdit className="w-3 h-3 text-green-600" />
                <span>
                    {writeResult.mode === "created"
                        ? "Created"
                        : writeResult.mode === "appended"
                          ? "Appended to"
                          : "Overwrote"}{" "}
                    <code className="bg-muted px-1 rounded">{writeResult.path}</code>
                </span>
                <span className="text-muted-foreground/60">
                    ({writeResult.bytesWritten} bytes)
                </span>
            </div>
        )
    }
    
    return (
        <div className="text-xs text-red-600 flex items-center gap-2">
            <XCircle className="w-3 h-3" />
            <span>{writeResult?.error || "Failed to write file"}</span>
        </div>
    )
}
