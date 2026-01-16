"use client"

import {
    ArrowUp,
    ChevronDown,
    FileCode,
    FileText,
    ImageIcon,
    Link,
    Loader2,
    Paintbrush,
    Pencil,
    Plus,
    Sparkles,
    Square,
    X,
    Zap,
} from "lucide-react"
import Image from "next/image"
import type React from "react"
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { ButtonWithTooltip } from "@/components/button-with-tooltip"
import { Toolbox, type ToolboxRef } from "@/components/toolbox"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useChatInput, type UseChatInputOptions } from "@/hooks/use-chat-input"
import type { UseModelConfigReturn } from "@/hooks/use-model-config"
import { isPdfFile, isTextFile, type UrlData } from "@/shared/extract-content"
import type { FlattenedModel } from "@/shared/types/model-config"
import { cn } from "@/shared/utils"
import { IMAGE_STYLES, type ImageStyleId } from "../file-preview-list"

interface ChatInputProps extends UseChatInputOptions {
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
    pdfData?: Map<
        File,
        { text: string; charCount: number; isExtracting: boolean }
    >
    sessionId?: string
    // Model selector props
    models?: FlattenedModel[]
    selectedModelId?: string
    onModelSelect?: (modelId: string | undefined) => void
    showUnvalidatedModels?: boolean
    // Model config (for inline config in toolbox)
    modelConfig?: UseModelConfigReturn
    // Stop callback
    onStop?: () => void
    // Diagram style
    minimalStyle?: boolean
    onMinimalStyleChange?: (value: boolean) => void
    // Engine switch
    activeEngine?: string
    onEngineSwitch?: () => void
    isEngineSwitching?: boolean
    // Dialog state (to disable click outside when dialog is open)
    isDialogOpen?: boolean
}

export interface ChatInputRef {
    focus: () => void
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(function ChatInput({
    input,
    status,
    onSubmit,
    onChange,
    onHistoryPrev,
    onHistoryNext,
    files = [],
    onFileChange = () => {},
    pdfData = new Map(),
    urlData,
    onUrlChange,
    sessionId,
    error = null,
    models = [],
    selectedModelId,
    onModelSelect = () => {},
    showUnvalidatedModels = false,
    modelConfig,
    engineId = "drawio",
    onStop,
    minimalStyle = false,
    onMinimalStyleChange = () => {},
    activeEngine = "drawio",
    onEngineSwitch = () => {},
    isEngineSwitching = false,
    isDialogOpen = false,
}, ref) {
    const chatInput = useChatInput({
        input,
        status,
        onChange,
        onHistoryPrev,
        onHistoryNext,
        files,
        onFileChange,
        urlData,
        onUrlChange,
        error,
        engineId,
        models,
        showUnvalidatedModels,
        onModelSelect,
        // onSkillSelect 由父组件传入，布局此处不方便处理
    })

    const {
        // Refs
        textareaRef,
        fileInputRef,
        slashButtonRef,
        // 状态
        isLoading,
        isToolbarDisabled,
        isDragging,
        isToolboxOpen,
        isMultiLineMode,
        toolboxSearchQuery,
        toolboxOpenMode,
        selectedItemIndex,
        focusArea,
        // 命令和可选项
        commands,
        filteredCommands,
        filteredSkills,
        filteredModels,
        selectableItems,
        // 状态设置
        setToolboxSearchQuery,
        setFocusArea,
        toolboxKeyHandlerRef,
        // 事件处理
        handleChange,
        handleKeyDown,
        handlePaste,
        handleFileChange,
        handleRemoveFile,
        triggerFileInput,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handleRemoveUrl,
        handleCommandClick,
        handleSelectableItemClick,
        handleToolboxKeyDown,
        // 操作
        toggleToolbox,
        closeToolbox,
        // 字典
        dict,
    } = chatInput
    
    // Toolbox 的 ref
    const toolboxRef = useRef<ToolboxRef>(null)
    
    // 将 Toolbox 的键盘处理函数绑定到 hook 的 ref
    useEffect(() => {
        toolboxKeyHandlerRef.current = (e: React.KeyboardEvent) => {
            toolboxRef.current?.handleKeyDown(e)
        }
    }, [toolboxKeyHandlerRef])

    // 文件分类
    const imageFiles = files.filter(f => f.type.startsWith("image/"))
    const pdfFiles = files.filter(f => isPdfFile(f))
    const textFiles = files.filter(f => isTextFile(f))
    const hasImages = imageFiles.length > 0
    const hasFiles = files.length > 0

    // 图生图模式状态（点击编辑按钮进入）
    const [isImageToImageMode, setIsImageToImageMode] = useState(false)
    const [imageStyle, setImageStyle] = useState<ImageStyleId>("original")
    const [isStyleDropdownOpen, setIsStyleDropdownOpen] = useState(false)
    const styleDropdownRef = useRef<HTMLDivElement>(null)

    // 图片徽章悬浮状态
    const [isImageBadgeHovered, setIsImageBadgeHovered] = useState(false)

    // 发送按钮悬浮状态（用于加载时显示停止按钮）
    const [isSendButtonHovered, setIsSendButtonHovered] = useState(false)

    // 图片预览弹窗
    const [selectedImage, setSelectedImage] = useState<string | null>(null)

    // 图片 URL 缓存
    const [imageUrls, setImageUrls] = useState<Map<File, string>>(new Map())
    const imageUrlsRef = useRef<Map<File, string>>(new Map())

    // 创建图片 URL
    useEffect(() => {
        const currentUrls = imageUrlsRef.current
        const newUrls = new Map<File, string>()

        files.forEach((file) => {
            if (file.type.startsWith("image/")) {
                const existingUrl = currentUrls.get(file)
                if (existingUrl) {
                    newUrls.set(file, existingUrl)
                } else {
                    newUrls.set(file, URL.createObjectURL(file))
                }
            }
        })

        currentUrls.forEach((url, file) => {
            if (!newUrls.has(file)) {
                URL.revokeObjectURL(url)
            }
        })

        imageUrlsRef.current = newUrls
        setImageUrls(newUrls)
    }, [files])

    // 清理 URL
    useEffect(() => {
        return () => {
            imageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
            imageUrlsRef.current = new Map()
        }
    }, [])

    // 点击外部关闭风格下拉
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (styleDropdownRef.current && !styleDropdownRef.current.contains(e.target as Node)) {
                setIsStyleDropdownOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // 没有图片时退出图生图模式
    useEffect(() => {
        if (!hasImages) {
            setIsImageToImageMode(false)
            setImageStyle("original")
        }
    }, [hasImages])

    // 格式化字数
    const formatCharCount = (count: number): string => {
        if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}k`
        }
        return String(count)
    }

    // Expose focus method to parent component
    useImperativeHandle(ref, () => ({
        focus: () => {
            textareaRef.current?.focus()
        },
    }))

    // 隐藏的文件输入
    const HiddenFileInput = (
        <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
            accept="image/*,.pdf,application/pdf,text/*,.md,.markdown,.json,.csv,.xml,.yaml,.yml,.toml"
            multiple
            disabled={isToolbarDisabled}
        />
    )

    // 获取当前风格名称
    const currentStyleLabel = IMAGE_STYLES.find(s => s.id === imageStyle)?.label || "原图"

    // 是否显示多行模式（有文件或多行内容时）
    const showMultiLineMode = isMultiLineMode || hasFiles

    return (
        <form
            onSubmit={onSubmit}
            className={cn(
                "w-full",
                isDragging && "ring-2 ring-primary ring-offset-2 rounded-2xl"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* 输入框容器 */}
            <div className={cn(
                "relative rounded-2xl bg-muted transition-all duration-200",
            )}>
                {/* 工具箱 */}
                {isToolboxOpen && modelConfig && (
                    <Toolbox
                        ref={toolboxRef}
                        searchQuery={toolboxSearchQuery}
                        onSearchChange={setToolboxSearchQuery}
                        // 统一可选项列表
                        filteredCommands={filteredCommands}
                        filteredSkills={filteredSkills}
                        filteredModels={filteredModels}
                        selectableItems={selectableItems}
                        selectedItemIndex={selectedItemIndex}
                        onSelectableItemClick={handleSelectableItemClick}
                        onKeyDown={handleToolboxKeyDown}
                        // 模型相关
                        models={models}
                        selectedModelId={selectedModelId}
                        onModelSelect={onModelSelect}
                        showUnvalidatedModels={showUnvalidatedModels}
                        modelConfig={modelConfig}
                        // 工具箱打开方式
                        toolboxOpenMode={toolboxOpenMode}
                        // 焦点管理
                        focusArea={focusArea}
                        onFocusChange={setFocusArea}
                        // 操作
                        onUploadFile={triggerFileInput}
                        onUrlChange={onUrlChange}
                        urlData={urlData}
                        onClose={closeToolbox}
                        onFocusBack={() => textareaRef.current?.focus()}
                        // 当有 Dialog 打开时禁用点击外部关闭
                        disableClickOutside={(() => {
                            console.log('[ChatInput] isDialogOpen:', isDialogOpen)
                            return isDialogOpen
                        })()}
                    />
                )}

                {/* 多行模式 */}
                {showMultiLineMode ? (
                    <>
                        {/* 文件预览区 */}
                        {hasFiles && (
                            <div className="flex gap-2 px-4 pt-4 pb-2 overflow-x-auto">
                                {/* 图片预览 */}
                                {imageFiles.map((file, idx) => {
                                    const url = imageUrls.get(file)
                                    if (!url) return null
                                    return (
                                        <div key={file.name + idx} className="relative group shrink-0">
                                            <div
                                                className="w-20 h-20 rounded-xl overflow-hidden bg-muted cursor-pointer"
                                                onClick={() => setSelectedImage(url)}
                                            >
                                                <Image
                                                    src={url}
                                                    alt={file.name}
                                                    width={80}
                                                    height={80}
                                                    className="object-cover w-full h-full"
                                                    unoptimized
                                                />
                                            </div>
                                            {/* 操作按钮组 */}
                                            <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {/* 编辑按钮 - 进入图生图模式 */}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setIsImageToImageMode(true)
                                                    }}
                                                    className="h-6 w-6 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors shadow-sm"
                                                    aria-label="图生图模式"
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </button>
                                                {/* 删除按钮 */}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleRemoveFile(file)
                                                    }}
                                                    className="h-6 w-6 rounded-full bg-foreground text-background flex items-center justify-center hover:bg-foreground/80 transition-colors shadow-sm"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}

                                {/* PDF 文件预览 */}
                                {pdfFiles.map((file, idx) => {
                                    const pdfInfo = pdfData.get(file)
                                    return (
                                        <div key={file.name + idx} className="relative group shrink-0">
                                            <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted flex flex-col items-center justify-center p-1">
                                                {pdfInfo?.isExtracting ? (
                                                    <Loader2 className="h-6 w-6 text-red-500 mb-1 animate-spin" />
                                                ) : (
                                                    <FileText className="h-6 w-6 text-red-500 mb-1" />
                                                )}
                                                <span className="text-xs text-center truncate w-full px-1">
                                                    {file.name.length > 10 ? `${file.name.slice(0, 7)}...` : file.name}
                                                </span>
                                                {pdfInfo?.isExtracting ? (
                                                    <span className="text-[10px] text-muted-foreground">读取中</span>
                                                ) : pdfInfo?.charCount ? (
                                                    <span className="text-[10px] text-green-600 font-medium">
                                                        {formatCharCount(pdfInfo.charCount)} 字
                                                    </span>
                                                ) : null}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveFile(file)}
                                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-foreground text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )
                                })}

                                {/* 文本文件预览 */}
                                {textFiles.map((file, idx) => {
                                    const textInfo = pdfData.get(file)
                                    return (
                                        <div key={file.name + idx} className="relative group shrink-0">
                                            <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted flex flex-col items-center justify-center p-1">
                                                {textInfo?.isExtracting ? (
                                                    <Loader2 className="h-6 w-6 text-blue-500 mb-1 animate-spin" />
                                                ) : (
                                                    <FileCode className="h-6 w-6 text-blue-500 mb-1" />
                                                )}
                                                <span className="text-xs text-center truncate w-full px-1">
                                                    {file.name.length > 10 ? `${file.name.slice(0, 7)}...` : file.name}
                                                </span>
                                                {textInfo?.isExtracting ? (
                                                    <span className="text-[10px] text-muted-foreground">读取中</span>
                                                ) : textInfo?.charCount ? (
                                                    <span className="text-[10px] text-green-600 font-medium">
                                                        {formatCharCount(textInfo.charCount)} 字
                                                    </span>
                                                ) : null}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveFile(file)}
                                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-foreground text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )
                                })}

                                {/* URL 预览 */}
                                {urlData && Array.from(urlData.entries()).map(([url, data], idx) => (
                                    <div key={url + idx} className="relative group shrink-0">
                                        <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted flex flex-col items-center justify-center p-1">
                                            {data.isExtracting ? (
                                                <Loader2 className="h-6 w-6 text-blue-500 mb-1 animate-spin" />
                                            ) : (
                                                <Link className="h-6 w-6 text-blue-500 mb-1" />
                                            )}
                                            <span className="text-xs text-center truncate w-full px-1">
                                                {data.title.length > 10 ? `${data.title.slice(0, 7)}...` : data.title}
                                            </span>
                                            {data.isExtracting ? (
                                                <span className="text-[10px] text-muted-foreground">读取中</span>
                                            ) : data.charCount ? (
                                                <span className="text-[10px] text-green-600 font-medium">
                                                    {formatCharCount(data.charCount)} 字
                                                </span>
                                            ) : null}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveUrl(url)}
                                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-foreground text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 多行输入框 */}
                        <Textarea
                            ref={textareaRef}
                            value={input || ""}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            placeholder={isImageToImageMode ? "描述您想要的图片效果..." : hasImages ? "描述图片内容..." : dict.chat.placeholder}
                            aria-label="Chat input"
                            rows={2}
                            className="w-full min-h-14 max-h-50 resize-none border-0 border-none! bg-transparent px-4 py-3 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-none placeholder:text-muted-foreground/60"
                        />

                        {/* 底部工具栏 */}
                        <div className="flex items-center gap-1 px-3 pb-3">
                            <ButtonWithTooltip
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={toggleToolbox}
                                disabled={isToolbarDisabled}
                                tooltipContent="命令与工具"
                                className={cn(
                                    "h-8 w-8 rounded-full border",
                                    isToolboxOpen 
                                        ? "text-primary bg-primary/10 border-primary/30" 
                                        : "text-muted-foreground border-border hover:text-foreground hover:bg-muted/80 hover:border-muted-foreground/30"
                                )}
                                ref={slashButtonRef}
                            >
                                <Plus className="h-5 w-5" />
                            </ButtonWithTooltip>

                            {HiddenFileInput}

                            {/* 引擎切换按钮 */}
                            <ButtonWithTooltip
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={onEngineSwitch}
                                disabled={isToolbarDisabled || isEngineSwitching}
                                tooltipContent={activeEngine === "drawio" ? "当前引擎 Draw.io" : "当前引擎 Excalidraw"}
                                className={cn(
                                    "h-8 w-8 rounded-full border transition-all",
                                    "text-muted-foreground border-border hover:text-foreground hover:bg-muted/80"
                                )}
                            >
                                {activeEngine === "drawio" ? (
                                    <svg
                                        width={16}
                                        height={16}
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <rect x="3" y="3" width="7" height="7" rx="1"/>
                                        <rect x="14" y="3" width="7" height="7" rx="1"/>
                                        <rect x="3" y="14" width="7" height="7" rx="1"/>
                                        <rect x="14" y="14" width="7" height="7" rx="1"/>
                                        <line x1="10" y1="6.5" x2="14" y2="6.5"/>
                                        <line x1="10" y1="17.5" x2="14" y2="17.5"/>
                                        <line x1="6.5" y1="10" x2="6.5" y2="14"/>
                                        <line x1="17.5" y1="10" x2="17.5" y2="14"/>
                                    </svg>
                                ) : (
                                    <svg
                                        width={16}
                                        height={16}
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M3 17.5l5-5 4 4 6-6"/>
                                        <polyline points="16,12 18,10 22,6"/>
                                        <circle cx="6" cy="20" r="2"/>
                                        <path d="M20 4l-4 4"/>
                                        <path d="M4 4h7v7"/>
                                    </svg>
                                )}
                            </ButtonWithTooltip>

                            {/* 图表样式切换按钮 */}
                            <ButtonWithTooltip
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => onMinimalStyleChange?.(!minimalStyle)}
                                disabled={isToolbarDisabled}
                                tooltipContent={minimalStyle ? "简约模式（快速生成）" : "精致模式（带颜色）"}
                                className="h-8 w-8 rounded-full border transition-all text-muted-foreground border-border hover:text-foreground hover:bg-muted/80"
                            >
                                {minimalStyle ? (
                                    <Zap className="h-4 w-4" />
                                ) : (
                                    <Sparkles className="h-4 w-4" />
                                )}
                            </ButtonWithTooltip>

                            {/* 图生图模式工具 */}
                            {isImageToImageMode && hasImages && (
                                <>
                                    {/* 图片徽章 - 悬浮切换 */}
                                    <button
                                        type="button"
                                        className={cn(
                                            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm transition-all",
                                            isImageBadgeHovered
                                                ? "bg-destructive/10 text-destructive"
                                                : "bg-primary/10 text-primary"
                                        )}
                                        onClick={() => setIsImageToImageMode(false)}
                                        onMouseEnter={() => setIsImageBadgeHovered(true)}
                                        onMouseLeave={() => setIsImageBadgeHovered(false)}
                                    >
                                        {isImageBadgeHovered ? (
                                            <X className="h-4 w-4" />
                                        ) : (
                                            <ImageIcon className="h-4 w-4" />
                                        )}
                                        <span>图生图</span>
                                    </button>

                                    {/* 风格选择器 */}
                                    <div className="relative" ref={styleDropdownRef}>
                                        <button
                                            type="button"
                                            onClick={() => setIsStyleDropdownOpen(!isStyleDropdownOpen)}
                                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                        >
                                            <span>风格</span>
                                            <span className="text-foreground">{currentStyleLabel}</span>
                                            <ChevronDown className={cn("h-4 w-4 transition-transform", isStyleDropdownOpen && "rotate-180")} />
                                        </button>

                                        {isStyleDropdownOpen && (
                                            <div className="absolute bottom-full left-0 mb-2 w-48 rounded-xl bg-popover border border-border shadow-lg overflow-hidden z-50">
                                                {IMAGE_STYLES.map((style) => (
                                                    <button
                                                        key={style.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setImageStyle(style.id)
                                                            setIsStyleDropdownOpen(false)
                                                        }}
                                                        className={cn(
                                                            "w-full px-3 py-2 text-left text-sm transition-colors flex items-center justify-between",
                                                            imageStyle === style.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                                                        )}
                                                    >
                                                        <span>{style.label}</span>
                                                        <span className="text-xs text-muted-foreground">{style.desc}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            <div className="flex-1" />

                            {/* 发送/停止按钮 */}
                            {isLoading ? (
                                <Button
                                    type="button"
                                    onClick={onStop}
                                    size="icon"
                                    className={cn(
                                        "h-8 w-8 rounded-full transition-all border",
                                        isSendButtonHovered
                                            ? "bg-destructive text-destructive-foreground border-destructive"
                                            : "bg-foreground text-background border-foreground"
                                    )}
                                    onMouseEnter={() => setIsSendButtonHovered(true)}
                                    onMouseLeave={() => setIsSendButtonHovered(false)}
                                    aria-label="停止生成"
                                >
                                    {isSendButtonHovered ? (
                                        <Square className="h-3.5 w-3.5 fill-current" />
                                    ) : (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    )}
                                </Button>
                            ) : (
                                <ButtonWithTooltip
                                    type="submit"
                                    disabled={!input.trim() && !hasFiles}
                                    size="icon"
                                    tooltipContent="Enter 换行，Shift + Enter 发送"
                                    className={cn(
                                        "h-8 w-8 rounded-full transition-all border",
                                        (input.trim() || hasFiles)
                                            ? "bg-foreground text-background border-foreground hover:bg-foreground/90"
                                            : "bg-transparent text-muted-foreground border-border hover:bg-muted/80 hover:border-muted-foreground/30"
                                    )}
                                >
                                    <ArrowUp className="h-4 w-4" />
                                </ButtonWithTooltip>
                            )}
                        </div>
                    </>
                ) : (
                    /* 单行模式：[+] [输入框] [↑] */
                    <div className="flex items-center px-2 py-1.5">
                        <ButtonWithTooltip
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={toggleToolbox}
                            disabled={isToolbarDisabled}
                            tooltipContent="命令与工具"
                            className={cn(
                                "h-9 w-9 rounded-full shrink-0 border",
                                isToolboxOpen 
                                    ? "text-primary bg-primary/10 border-primary/30" 
                                    : "text-muted-foreground border-border hover:text-foreground hover:bg-muted/80 hover:border-muted-foreground/30"
                            )}
                            ref={slashButtonRef}
                        >
                            <Plus className="h-5 w-5" />
                        </ButtonWithTooltip>

                        {HiddenFileInput}

                        <Textarea
                            ref={textareaRef}
                            value={input || ""}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            placeholder={dict.chat.placeholder}
                            aria-label="Chat input"
                            rows={1}
                            style={{ height: '40px', minHeight: '40px', maxHeight: '40px' }}
                            className="flex-1 resize-none border-0 border-none! bg-transparent py-2 px-2 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-none placeholder:text-muted-foreground/60 overflow-hidden min-h-0!"
                        />

                        {/* 发送/停止按钮 */}
                        {isLoading ? (
                            <Button
                                type="button"
                                onClick={onStop}
                                size="icon"
                                className={cn(
                                    "h-9 w-9 rounded-full shrink-0 transition-all border",
                                    isSendButtonHovered
                                        ? "bg-destructive text-destructive-foreground border-destructive"
                                        : "bg-foreground text-background border-foreground"
                                )}
                                onMouseEnter={() => setIsSendButtonHovered(true)}
                                onMouseLeave={() => setIsSendButtonHovered(false)}
                                aria-label="停止生成"
                            >
                                {isSendButtonHovered ? (
                                    <Square className="h-4 w-4 fill-current" />
                                ) : (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                )}
                            </Button>
                        ) : (
                            <ButtonWithTooltip
                                type="submit"
                                disabled={!input.trim()}
                                size="icon"
                                tooltipContent="Enter 换行，Shift + Enter 发送"
                                className={cn(
                                    "h-9 w-9 rounded-full shrink-0 transition-all border",
                                    input.trim()
                                        ? "bg-foreground text-background border-foreground hover:bg-foreground/90"
                                        : "bg-transparent text-muted-foreground border-border hover:bg-muted/80 hover:border-muted-foreground/30"
                                )}
                            >
                                <ArrowUp className="h-5 w-5" />
                            </ButtonWithTooltip>
                        )}
                    </div>
                )}
            </div>

            {/* 图片预览弹窗 */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <button
                        type="button"
                        className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 hover:bg-gray-200 transition-colors"
                        onClick={() => setSelectedImage(null)}
                        aria-label="关闭"
                    >
                        <X className="h-6 w-6" />
                    </button>
                    <div className="relative w-auto h-auto max-w-[90vw] max-h-[90vh]">
                        <Image
                            src={selectedImage}
                            alt="图片预览"
                            width={1200}
                            height={900}
                            className="object-contain max-w-full max-h-[90vh] w-auto h-auto"
                            onClick={(e) => e.stopPropagation()}
                            unoptimized
                        />
                    </div>
                </div>
            )}
        </form>
    )
})
