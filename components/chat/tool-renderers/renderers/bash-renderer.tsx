"use client"

import { Terminal, XCircle } from "lucide-react"
import type { ToolContentRendererProps } from "../types"

/**
 * Bash 命令工具内容渲染器
 */
export function BashRenderer({ part }: ToolContentRendererProps) {
    const { state, output } = part
    
    // 只在完成时显示结果
    if (state !== "output-available") {
        return null
    }
    
    const bashResult = output as {
        success?: boolean
        command?: string
        stdout?: string
        stderr?: string
        exitCode?: number
        error?: string
    } | null
    
    return (
        <>
            {bashResult?.command && (
                <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                    <Terminal className="w-3 h-3" />
                    <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
                        {bashResult.command}
                    </code>
                    {bashResult.success ? (
                        <span className="text-green-600 text-[10px]">✓ exit 0</span>
                    ) : (
                        <span className="text-red-600 text-[10px]">
                            ✗ exit {bashResult.exitCode ?? 1}
                        </span>
                    )}
                </div>
            )}
            {(bashResult?.stdout || bashResult?.stderr) && (
                <pre className="text-xs bg-muted/50 p-2 rounded-md overflow-auto max-h-60 whitespace-pre-wrap font-mono">
                    {bashResult.stdout && (
                        <span className="text-foreground/80">
                            {bashResult.stdout.substring(0, 3000)}
                        </span>
                    )}
                    {bashResult.stderr && (
                        <span className="text-red-600">
                            {bashResult.stderr.substring(0, 1000)}
                        </span>
                    )}
                    {((bashResult.stdout?.length || 0) > 3000 ||
                        (bashResult.stderr?.length || 0) > 1000) &&
                        "\n..."}
                </pre>
            )}
            {bashResult?.error && !bashResult.stdout && !bashResult.stderr && (
                <div className="text-xs text-red-600 flex items-center gap-2">
                    <XCircle className="w-3 h-3" />
                    <span>{bashResult.error}</span>
                </div>
            )}
        </>
    )
}
