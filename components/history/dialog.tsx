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
        engineId,
        excalidrawHistory,
        restoreExcalidrawVersion,
    } = useEngine()
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

    // 根据当前引擎选择历史记录
    const isExcalidraw = engineId === "excalidraw"
    const historyItems = isExcalidraw ? excalidrawHistory : diagramHistory
    const hasHistory = historyItems.length > 0

    const handleClose = () => {
        setSelectedIndex(null)
        onToggleHistory(false)
    }

    const handleConfirmRestore = () => {
        if (selectedIndex !== null) {
            if (isExcalidraw) {
                // 恢复 Excalidraw 版本
                restoreExcalidrawVersion(selectedIndex)
            } else {
                // 恢复 DrawIO 版本（跳过验证）
                onDisplayChart(diagramHistory[selectedIndex].xml, true)
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
                        {isExcalidraw
                            ? // Excalidraw 历史记录
                              excalidrawHistory.map((item, index) => (
                                  <div
                                      key={item.timestamp}
                                      className={`border rounded-md p-2 cursor-pointer hover:border-primary transition-colors ${
                                          selectedIndex === index
                                              ? "border-primary ring-2 ring-primary"
                                              : ""
                                      }`}
                                      onClick={() => setSelectedIndex(index)}
                                  >
                                      <div className="aspect-video bg-white dark:bg-gray-800 rounded overflow-hidden flex items-center justify-center">
                                          {item.thumbnailDataUrl ? (
                                              <Image
                                                  src={item.thumbnailDataUrl}
                                                  alt={`${dict.history.version} ${index + 1}`}
                                                  width={200}
                                                  height={100}
                                                  className="object-contain w-full h-full p-1"
                                              />
                                          ) : (
                                              <div className="text-xs text-muted-foreground">
                                                  {item.scene.elements.length} 个元素
                                              </div>
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
                              ))
                            : // DrawIO 历史记录
                              diagramHistory.map((item, index) => (
                                  <div
                                      key={index}
                                      className={`border rounded-md p-2 cursor-pointer hover:border-primary transition-colors ${
                                          selectedIndex === index
                                              ? "border-primary ring-2 ring-primary"
                                              : ""
                                      }`}
                                      onClick={() => setSelectedIndex(index)}
                                  >
                                      <div className="aspect-video bg-white rounded overflow-hidden flex items-center justify-center">
                                          <Image
                                              src={item.svg}
                                              alt={`${dict.history.version} ${index + 1}`}
                                              width={200}
                                              height={100}
                                              className="object-contain w-full h-full p-1"
                                          />
                                      </div>
                                      <div className="text-xs text-center mt-1 text-gray-500">
                                          {dict.history.version} {index + 1}
                                      </div>
                                  </div>
                              ))}
                    </div>
                )}

                <DialogFooter>
                    {selectedIndex !== null ? (
                        <>
                            <div className="flex-1 text-sm text-muted-foreground">
                                {formatMessage(dict.history.restoreTo, {
                                    version: selectedIndex + 1,
                                })}
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setSelectedIndex(null)}
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
