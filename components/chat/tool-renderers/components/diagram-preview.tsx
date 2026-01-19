"use client"

import { ImageOff } from "lucide-react"

interface DiagramPreviewProps {
    /** 预览图 URL（base64 data URL 或 http URL） */
    previewDataUrl?: string
    /** 备用文本 */
    alt?: string
    /** 最大高度 */
    maxHeight?: number
}

/**
 * 图表预览组件
 * 显示渲染后的 SVG/PNG 缩略图
 */
export function DiagramPreview({
    previewDataUrl,
    alt = "Diagram Preview",
    maxHeight = 300,
}: DiagramPreviewProps) {
    if (!previewDataUrl) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <ImageOff className="w-8 h-8 mb-2 opacity-50" />
                <span className="text-sm">Preview not available</span>
            </div>
        )
    }

    return (
        <div className="flex justify-center p-2 bg-background/50 rounded-lg">
            <img
                src={previewDataUrl}
                alt={alt}
                className="max-w-full object-contain rounded"
                style={{ maxHeight }}
            />
        </div>
    )
}
