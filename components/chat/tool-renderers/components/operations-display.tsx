"use client"

import type { DiagramOperation } from "../../types"

interface OperationsDisplayProps {
    operations: DiagramOperation[]
}

/**
 * 图表编辑操作展示组件
 * 用于显示 edit_drawio / edit_excalidraw 的操作列表
 */
export function OperationsDisplay({ operations }: OperationsDisplayProps) {
    return (
        <div className="space-y-3">
            {operations.map((op, index) => (
                <div
                    key={`${op.operation}-${op.cell_id}-${index}`}
                    className="rounded-lg border border-border/50 overflow-hidden bg-background/50"
                >
                    <div className="px-3 py-1.5 bg-muted/40 border-b border-border/30 flex items-center gap-2">
                        <span
                            className={`text-[10px] font-medium uppercase tracking-wide ${
                                op.operation === "delete"
                                    ? "text-red-600"
                                    : op.operation === "add"
                                      ? "text-green-600"
                                      : "text-blue-600"
                            }`}
                        >
                            {op.operation}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            cell_id: {op.cell_id}
                        </span>
                    </div>
                    {op.new_xml && (
                        <div className="px-3 py-2">
                            <pre className="text-[11px] font-mono text-foreground/80 bg-muted/30 rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-all">
                                {op.new_xml}
                            </pre>
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}
