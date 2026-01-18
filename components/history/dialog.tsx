"use client"

import Image from "next/image"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useEngine } from "@/hooks/engines/engine-context"
import { useDictionary } from "@/hooks/use-dictionary"
import { formatMessage } from "@/shared/i18n/utils"
import { DrawioIcon, ExcalidrawIcon } from "@/components/ui/engine-icons"
import type { UnifiedHistoryEntry } from "@/hooks/session"

interface HistoryDialogProps {
    showHistory: boolean
    onToggleHistory: (show: boolean) => void
}

export function HistoryDialog({
    showHistory,
    onToggleHistory,
}: HistoryDialogProps) {
    const dict = useDictionary()
    const {
        loadDiagram: onDisplayChart,
        diagramHistory,
        excalidrawHistory,
        restoreExcalidrawVersion,
        unifiedHistory,
    } = useEngine()
    const [selectedEntry, setSelectedEntry] = useState<UnifiedHistoryEntry | null>(null)

    const hasHistory = unifiedHistory.length > 0

    const handleClose = () => {
        setSelectedEntry(null)
        onToggleHistory(false)
    }

    const handleConfirmRestore = () => {
        if (selectedEntry) {
            if (selectedEntry.engineId === "excalidraw") {
                // 恢复 Excalidraw 版本
                restoreExcalidrawVersion(selectedEntry.originalIndex)
            } else {
                // 恢复 DrawIO 版本（跳过验证）
                if (selectedEntry.xml) {
                    onDisplayChart(selectedEntry.xml, true)
                }
            }
            handleClose()
        }
    }

    // 格式化时间戳
    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp)
        return date.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        })
    }

    return (
        <Dialog open={showHistory} onOpenChange={onToggleHistory}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{dict.history.title}</DialogTitle>
                    <DialogDescription>
                        {dict.history.description}
                    </DialogDescription>
                </DialogHeader>

                {!hasHistory ? (
                    <div className="text-center p-4 text-gray-500">
                        {dict.history.noHistory}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
                        {unifiedHistory.map((item) => {
                            const thumbnailUrl = item.engineId === "excalidraw" 
                                ? item.thumbnailDataUrl 
                                : item.svg
                            const isSelected = selectedEntry?.timestamp === item.timestamp && 
                                               selectedEntry?.engineId === item.engineId
                            
                            return (
                                <div
                                    key={`${item.engineId}-${item.timestamp}`}
                                    className={`relative border rounded-md p-2 cursor-pointer hover:border-primary transition-colors ${
                                        isSelected
                                            ? "border-primary ring-2 ring-primary"
                                            : ""
                                    }`}
                                    onClick={() => setSelectedEntry(item)}
                                >
                                    <div className="aspect-video bg-white dark:bg-gray-800 rounded overflow-hidden flex items-center justify-center">
                                        {thumbnailUrl ? (
                                            <Image
                                                src={thumbnailUrl}
                                                alt={formatTimestamp(item.timestamp)}
                                                width={200}
                                                height={100}
                                                className="object-contain w-full h-full p-1"
                                            />
                                        ) : (
                                            <div className="text-xs text-muted-foreground">
                                                {item.engineId === "excalidraw" && item.scene 
                                                    ? `${item.scene.elements.length} 个元素`
                                                    : "无预览"
                                                }
                                            </div>
                                        )}
                                    </div>
                                    {/* 引擎图标 badge */}
                                    <div className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm rounded p-0.5 border border-border/50">
                                        {item.engineId === "excalidraw" ? (
                                            <ExcalidrawIcon className="h-3 w-3 text-muted-foreground" />
                                        ) : (
                                            <DrawioIcon className="h-3 w-3 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div className="text-xs text-center mt-1 text-gray-500">
                                        <div>{formatTimestamp(item.timestamp)}</div>
                                        {item.label && (
                                            <div className="text-primary/70 truncate">
                                                {item.label}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                <DialogFooter>
                    {selectedEntry !== null ? (
                        <>
                            <div className="flex-1 text-sm text-muted-foreground">
                                {formatMessage(dict.history.restoreTo, {
                                    version: formatTimestamp(selectedEntry.timestamp),
                                })}
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setSelectedEntry(null)}
                            >
                                {dict.common.cancel}
                            </Button>
                            <Button onClick={handleConfirmRestore}>
                                {dict.common.confirm}
                            </Button>
                        </>
                    ) : (
                        <Button variant="outline" onClick={handleClose}>
                            {dict.common.close}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
