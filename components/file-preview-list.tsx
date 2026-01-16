"use client"

import { FileCode, FileText, Link, Loader2, Pencil, X } from "lucide-react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useDictionary } from "@/hooks/use-dictionary"
import { isPdfFile, isTextFile } from "@/shared/extract-content"
import { cn } from "@/shared/utils"

function formatCharCount(count: number): string {
    if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}k`
    }
    return String(count)
}

// 图片风格选项
export const IMAGE_STYLES = [
    { id: "original", label: "原图", desc: "不应用任何风格" },
    { id: "cyberpunk", label: "赛博朋克", desc: "霸光、数码感" },
    { id: "anime", label: "动漫", desc: "日式动漫风格" },
    { id: "dramatic", label: "戏剧化", desc: "电影化胖像" },
    { id: "coloring", label: "填色画册", desc: "线稿风格" },
    { id: "photography", label: "专业摄影", desc: "真实感增强" },
    { id: "vintage", label: "复古卡通", desc: "80年代风格" },
    { id: "watercolor", label: "水彩", desc: "柔和艺术感" },
    { id: "sketch", label: "素描", desc: "铅笔画风格" },
] as const

export type ImageStyleId = typeof IMAGE_STYLES[number]["id"]

interface FilePreviewListProps {
    files: File[]
    onRemoveFile: (fileToRemove: File) => void
    pdfData?: Map<
        File,
        { text: string; charCount: number; isExtracting: boolean }
    >
    urlData?: Map<
        string,
        { url: string; title: string; charCount: number; isExtracting: boolean }
    >
    onRemoveUrl?: (url: string) => void
    // 图片风格相关
    imageStyles?: Map<File, ImageStyleId>
    onImageStyleChange?: (file: File, style: ImageStyleId) => void
}

export function FilePreviewList({
    files,
    onRemoveFile,
    pdfData = new Map(),
    urlData,
    onRemoveUrl,
    imageStyles = new Map(),
    onImageStyleChange,
}: FilePreviewListProps) {
    const dict = useDictionary()
    const [selectedImage, setSelectedImage] = useState<string | null>(null)
    const [imageUrls, setImageUrls] = useState<Map<File, string>>(new Map())
    const imageUrlsRef = useRef<Map<File, string>>(new Map())
    // 图片美化弹窗状态
    const [editingFile, setEditingFile] = useState<File | null>(null)
    const [tempStyle, setTempStyle] = useState<ImageStyleId>("original")
    // Create and cleanup object URLs when files change
    useEffect(() => {
        const currentUrls = imageUrlsRef.current
        const newUrls = new Map<File, string>()

        files.forEach((file) => {
            if (file.type.startsWith("image/")) {
                // Reuse existing URL if file is already tracked
                const existingUrl = currentUrls.get(file)
                if (existingUrl) {
                    newUrls.set(file, existingUrl)
                } else {
                    newUrls.set(file, URL.createObjectURL(file))
                }
            }
        })
        // Revoke URLs for files that are no longer in the list
        currentUrls.forEach((url, file) => {
            if (!newUrls.has(file)) {
                URL.revokeObjectURL(url)
            }
        })

        imageUrlsRef.current = newUrls
        setImageUrls(newUrls)
    }, [files])
    // Cleanup all URLs on unmount only
    useEffect(() => {
        return () => {
            imageUrlsRef.current.forEach((url) => {
                URL.revokeObjectURL(url)
            })
            // Clear the ref so StrictMode remount creates fresh URLs
            imageUrlsRef.current = new Map()
        }
    }, [])
    // Clear selected image if its URL was revoked
    useEffect(() => {
        if (
            selectedImage &&
            !Array.from(imageUrls.values()).includes(selectedImage)
        ) {
            setSelectedImage(null)
        }
    }, [imageUrls, selectedImage])

    if (files.length === 0 && (!urlData || urlData.size === 0)) return null

    return (
        <>
            <div className="flex flex-wrap gap-2 mt-2 p-2 bg-muted/50 rounded-md">
                {files.map((file, index) => {
                    const imageUrl = imageUrls.get(file) || null
                    const pdfInfo = pdfData.get(file)
                    return (
                        <div key={file.name + index} className="relative group">
                            <div
                                className={`w-20 h-20 border rounded-md overflow-hidden bg-muted ${
                                    file.type.startsWith("image/") && imageUrl
                                        ? "cursor-pointer"
                                        : ""
                                }`}
                                onClick={() =>
                                    file.type.startsWith("image/") &&
                                    imageUrl &&
                                    setSelectedImage(imageUrl)
                                }
                            >
                                {file.type.startsWith("image/") && imageUrl ? (
                                    <>
                                        <Image
                                            src={imageUrl}
                                            alt={file.name}
                                            width={80}
                                            height={80}
                                            className="object-cover w-full h-full"
                                            unoptimized
                                        />
                                        {/* 风格标签 */}
                                        {imageStyles.get(file) && imageStyles.get(file) !== "original" && (
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5">
                                                {IMAGE_STYLES.find(s => s.id === imageStyles.get(file))?.label}
                                            </div>
                                        )}
                                    </>
                                ) : isPdfFile(file) || isTextFile(file) ? (
                                    <div className="flex flex-col items-center justify-center h-full p-1">
                                        {pdfInfo?.isExtracting ? (
                                            <Loader2 className="h-6 w-6 text-blue-500 mb-1 animate-spin" />
                                        ) : isPdfFile(file) ? (
                                            <FileText className="h-6 w-6 text-red-500 mb-1" />
                                        ) : (
                                            <FileCode className="h-6 w-6 text-blue-500 mb-1" />
                                        )}
                                        <span className="text-xs text-center truncate w-full px-1">
                                            {file.name.length > 10
                                                ? `${file.name.slice(0, 7)}...`
                                                : file.name}
                                        </span>
                                        {pdfInfo?.isExtracting ? (
                                            <span className="text-[10px] text-muted-foreground">
                                                {dict.file.reading}
                                            </span>
                                        ) : pdfInfo?.charCount ? (
                                            <span className="text-[10px] text-green-600 font-medium">
                                                {formatCharCount(
                                                    pdfInfo.charCount,
                                                )}{" "}
                                                {dict.file.chars}
                                            </span>
                                        ) : null}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-xs text-center p-1">
                                        {file.name}
                                    </div>
                                )}
                            </div>
                            {/* 操作按钮组 */}
                            <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {/* 编辑按钮 - 仅图片显示 */}
                                {file.type.startsWith("image/") && onImageStyleChange && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setEditingFile(file)
                                            setTempStyle(imageStyles.get(file) || "original")
                                        }}
                                        className="bg-background border border-border rounded-full p-1 hover:bg-muted transition-colors shadow-sm"
                                        aria-label="编辑图片风格"
                                    >
                                        <Pencil className="h-3 w-3" />
                                    </button>
                                )}
                                {/* 删除按钮 */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onRemoveFile(file)
                                    }}
                                    className="bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90 transition-colors shadow-sm"
                                    aria-label={dict.file.removeFile}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                    )
                })}
                {/* URL previews */}
                {urlData && urlData.size > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {Array.from(urlData.entries()).map(
                            ([url, data], index) => (
                                <div
                                    key={url + index}
                                    className="relative group"
                                >
                                    <div className="w-20 h-20 border rounded-md overflow-hidden bg-muted">
                                        <div className="flex flex-col items-center justify-center h-full p-1">
                                            {data.isExtracting ? (
                                                <>
                                                    <Loader2 className="h-6 w-6 text-blue-500 mb-1 animate-spin" />
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {dict.file.reading}
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <Link className="h-6 w-6 text-blue-500 mb-1" />
                                                    <span className="text-xs text-center truncate w-full px-1">
                                                        {data.title.length > 10
                                                            ? `${data.title.slice(0, 7)}...`
                                                            : data.title}
                                                    </span>
                                                    {data.charCount && (
                                                        <span className="text-[10px] text-green-600 font-medium">
                                                            {formatCharCount(
                                                                data.charCount,
                                                            )}{" "}
                                                            {dict.file.chars}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {onRemoveUrl && (
                                        <button
                                            type="button"
                                            onClick={() => onRemoveUrl(url)}
                                            className="absolute -top-2 -right-2 bg-destructive rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            aria-label={dict.file.removeFile}
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                            ),
                        )}
                    </div>
                )}
            </div>
            {/* Image Modal/Lightbox */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <button
                        className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 hover:bg-gray-200 transition-colors"
                        onClick={() => setSelectedImage(null)}
                        aria-label={dict.common.close}
                    >
                        <X className="h-6 w-6" />
                    </button>
                    <div className="relative w-auto h-auto max-w-[90vw] max-h-[90vh]">
                        <Image
                            src={selectedImage}
                            alt="Full size preview of uploaded diagram or image"
                            width={1200}
                            height={900}
                            className="object-contain max-w-full max-h-[90vh] w-auto h-auto"
                            onClick={(e) => e.stopPropagation()}
                            unoptimized
                        />
                    </div>
                </div>
            )}

            {/* 图片美化弹窗 */}
            {editingFile && imageUrls.get(editingFile) && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setEditingFile(null)}
                >
                    <div
                        className="bg-background rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 头部 */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                            <button
                                type="button"
                                onClick={() => setEditingFile(null)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                ← 返回
                            </button>
                            <span className="font-medium">图片美化</span>
                            <div className="w-16" /> {/* 占位 */}
                        </div>

                        {/* 内容区 */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* 图片预览 */}
                            <div className="relative aspect-video bg-muted rounded-xl overflow-hidden flex items-center justify-center">
                                <Image
                                    src={imageUrls.get(editingFile)!}
                                    alt="Preview"
                                    width={600}
                                    height={400}
                                    className="object-contain max-w-full max-h-full"
                                    unoptimized
                                />
                                {/* 风格标签 */}
                                {tempStyle !== "original" && (
                                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                                        {IMAGE_STYLES.find(s => s.id === tempStyle)?.label}
                                    </div>
                                )}
                            </div>

                            {/* 风格选择 */}
                            <div>
                                <div className="text-sm text-muted-foreground mb-2">选择风格</div>
                                <div className="grid grid-cols-3 gap-2">
                                    {IMAGE_STYLES.map((style) => (
                                        <button
                                            key={style.id}
                                            type="button"
                                            onClick={() => setTempStyle(style.id)}
                                            className={cn(
                                                "flex flex-col items-center p-3 rounded-xl border-2 transition-all",
                                                tempStyle === style.id
                                                    ? "border-primary bg-primary/5"
                                                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                                            )}
                                        >
                                            <span className="text-sm font-medium">{style.label}</span>
                                            <span className="text-[10px] text-muted-foreground">{style.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 底部按钮 */}
                        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
                            <Button
                                variant="outline"
                                onClick={() => setEditingFile(null)}
                            >
                                取消
                            </Button>
                            <Button
                                onClick={() => {
                                    if (onImageStyleChange && editingFile) {
                                        onImageStyleChange(editingFile, tempStyle)
                                    }
                                    setEditingFile(null)
                                }}
                            >
                                应用风格
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
