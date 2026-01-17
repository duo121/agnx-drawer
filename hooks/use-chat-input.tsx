"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ErrorToast } from "@/components/error-toast"
import { type FocusArea } from "@/components/toolbox"
import { useDictionary } from "@/hooks/use-dictionary"
import { useToolboxFilter } from "@/hooks/use-toolbox-filter"
import { formatMessage } from "@/shared/i18n/utils"
import {
    isPdfFile,
    isTextFile,
    extractUrlContent,
    type UrlData,
} from "@/shared/extract-content"

const MAX_IMAGE_SIZE = 2 * 1024 * 1024 // 2MB
const MAX_FILES = 5

function isValidFileType(file: File): boolean {
    return file.type.startsWith("image/") || isPdfFile(file) || isTextFile(file)
}

function formatFileSize(bytes: number): string {
    const mb = bytes / 1024 / 1024
    if (mb < 0.01) return `${(bytes / 1024).toFixed(0)}KB`
    return `${mb.toFixed(2)}MB`
}

function showErrorToast(message: React.ReactNode) {
    toast.custom(
        (t) => (
            <ErrorToast message={message} onDismiss={() => toast.dismiss(t)} />
        ),
        { duration: 5000 },
    )
}

interface ValidationResult {
    validFiles: File[]
    errors: string[]
}

function validateFiles(
    newFiles: File[],
    existingCount: number,
    dict: any,
): ValidationResult {
    const errors: string[] = []
    const validFiles: File[] = []

    const availableSlots = MAX_FILES - existingCount

    if (availableSlots <= 0) {
        errors.push(formatMessage(dict.errors.maxFiles, { max: MAX_FILES }))
        return { validFiles, errors }
    }

    for (const file of newFiles) {
        if (validFiles.length >= availableSlots) {
            errors.push(
                formatMessage(dict.errors.onlyMoreAllowed, {
                    slots: availableSlots,
                }),
            )
            break
        }
        if (!isValidFileType(file)) {
            errors.push(
                formatMessage(dict.errors.unsupportedType, { name: file.name }),
            )
            continue
        }
        // Only check size for images (PDFs/text files are extracted client-side, so file size doesn't matter)
        const isExtractedFile = isPdfFile(file) || isTextFile(file)
        if (!isExtractedFile && file.size > MAX_IMAGE_SIZE) {
            const maxSizeMB = MAX_IMAGE_SIZE / 1024 / 1024
            errors.push(
                formatMessage(dict.errors.fileExceeds, {
                    name: file.name,
                    size: formatFileSize(file.size),
                    max: maxSizeMB,
                }),
            )
        } else {
            validFiles.push(file)
        }
    }

    return { validFiles, errors }
}

function showValidationErrors(errors: string[], dict: any) {
    if (errors.length === 0) return

    if (errors.length === 1) {
        showErrorToast(
            <span className="text-muted-foreground">{errors[0]}</span>,
        )
    } else {
        showErrorToast(
            <div className="flex flex-col gap-1">
                <span className="font-medium">
                    {formatMessage(dict.errors.filesRejected, {
                        count: errors.length,
                    })}
                </span>
                <ul className="text-muted-foreground text-xs list-disc list-inside">
                    {errors.slice(0, 3).map((err) => (
                        <li key={err}>{err}</li>
                    ))}
                    {errors.length > 3 && (
                        <li>
                            {formatMessage(dict.errors.andMore, {
                                count: errors.length - 3,
                            })}
                        </li>
                    )}
                </ul>
            </div>,
        )
    }
}

export interface Command {
    id: string
    type: "command"
    label: string
    desc: string
    enabled: boolean
    badge: string
}

export interface Skill {
    id: string
    type: "skill"
    label: string
    desc: string
    isCurrent: boolean
}

export interface ModelItem {
    id: string
    type: "model"
    modelId: string
    provider: string
    providerLabel: string
    validated?: boolean
}

// 统一的可选项类型
export type ToolboxSelectableItem = Command | Skill | ModelItem

export interface UseChatInputOptions {
    input: string
    status: "submitted" | "streaming" | "ready" | "error"
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
    onHistoryPrev?: () => string | null
    onHistoryNext?: () => string | null
    files?: File[]
    onFileChange?: (files: File[]) => void
    urlData?: Map<string, UrlData>
    onUrlChange?: (data: Map<string, UrlData>) => void
    error?: Error | null
    engineId?: string
    // 模型相关
    models?: { id: string; modelId: string; provider: string; providerLabel: string; validated?: boolean }[]
    showUnvalidatedModels?: boolean
    onModelSelect?: (modelId: string | undefined) => void
    onSkillSelect?: (skillId: string) => void
    // SKILL 选择状态
    selectedSkillIds?: Set<string>
}

export function useChatInput({
    input,
    status,
    onChange,
    onHistoryPrev,
    onHistoryNext,
    files = [],
    onFileChange = () => {},
    urlData,
    onUrlChange,
    error = null,
    engineId = "drawio",
    models = [],
    showUnvalidatedModels = false,
    onModelSelect,
    onSkillSelect,
    selectedSkillIds = new Set(),
}: UseChatInputOptions) {
    const dict = useDictionary()

    // Refs
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const commandInputRef = useRef<HTMLInputElement>(null)
    const commandPaletteRef = useRef<HTMLDivElement>(null)
    const slashButtonRef = useRef<HTMLButtonElement>(null)
    // 用于保存 Toolbox 的键盘处理函数引用
    const toolboxKeyHandlerRef = useRef<((e: React.KeyboardEvent) => void) | null>(null)

    // UI 状态
    const [isDragging, setIsDragging] = useState(false)
    const [showVersionList, setShowVersionList] = useState(false)
    const [showModelList, setShowModelList] = useState(false)
    const [showUrlDialog, setShowUrlDialog] = useState(false)
    const [isExtractingUrl, setIsExtractingUrl] = useState(false)

    // 工具箱状态
    const [isToolboxOpen, setIsToolboxOpen] = useState(false)
    const [toolboxSearchQuery, setToolboxSearchQuery] = useState("")
    const [selectedItemIndex, setSelectedItemIndex] = useState(0)
    // 追踪工具箱打开方式：'button' = 点击按钮打开, 'slash' = 斜杠命令触发
    const [toolboxOpenMode, setToolboxOpenMode] = useState<'button' | 'slash'>('button')
    // 焦点区域状态
    const [focusArea, setFocusArea] = useState<FocusArea>({ type: 'search' })

    // 多行模式状态
    const [isMultiLineMode, setIsMultiLineMode] = useState(false)

    // 命令定义 - 所有命令都可用，AI 会自动切换到对应引擎
    const commands: Command[] = [
        {
            id: "plantuml",
            type: "command",
            label: "/plantuml",
            desc: "生成 PlantUML 脚本并插入画板",
            enabled: true, // 始终可用，AI 会自动切换到 Draw.io
            badge: "Draw.io",
        },
        {
            id: "mermaid",
            type: "command",
            label: "/mermaid",
            desc: "生成 Mermaid 脚本并插入画板",
            enabled: true, // 始终可用，AI 会自动切换到 Excalidraw
            badge: "Excalidraw",
        },
    ]

    // Skills 定义 - 使用 selectedSkillIds 判断 isCurrent
    const skills: Skill[] = [
        {
            id: "drawio",
            type: "skill",
            label: "Draw.io",
            desc: "专业流程图、架构图绘制",
            isCurrent: selectedSkillIds.has("drawio"),
        },
        {
            id: "excalidraw",
            type: "skill",
            label: "Excalidraw",
            desc: "手绘风格白板绘图",
            isCurrent: selectedSkillIds.has("excalidraw"),
        },
    ]

    // 使用统一的过滤 Hook
    const {
        filterQuery,
        filterTerms,
        isSlashMode,
        filteredCommands,
        filteredSkills,
        filteredModels,
        matchedToolbarIndices,
        selectableItems,
    } = useToolboxFilter({
        input,
        toolboxSearchQuery,
        isToolboxOpen,
        toolboxOpenMode,
        commands,
        skills,
        models,
        sessions: [], // use-chat-input 不处理 sessions，由 Toolbox 组件通过 props 传入
        showUnvalidatedModels,
    })

    /**
     * 斜杠命令焦点匹配
     * 
     * 基于过滤结果来确定焦点位置：
     * 1. 如果有匹配的工具栏按钮，焦点第一个匹配的按钮
     * 2. 如果有过滤后的命令，焦点第一个命令
     * 3. 如果有过滤后的技能，焦点第一个技能
     * 4. 如果有过滤后的模型，焦点第一个模型
     */
    const findSlashMatch = useCallback((): FocusArea | null => {
        // 没有过滤词时不匹配
        if (filterTerms.length === 0) return null

        // 1. 匹配工具栏按钮（使用 matchedToolbarIndices）
        if (matchedToolbarIndices.length > 0) {
            return { type: 'toolbar', index: matchedToolbarIndices[0] }
        }

        // 2. 匹配 Commands
        if (filteredCommands.length > 0) {
            return { type: 'list', section: 'commands', index: 0 }
        }

        // 3. 匹配 Skills
        if (filteredSkills.length > 0) {
            return { type: 'list', section: 'skills', index: 0 }
        }

        // 4. 匹配 Models
        if (filteredModels.length > 0) {
            return { type: 'list', section: 'models', index: 0 }
        }

        return null
    }, [filterTerms, matchedToolbarIndices, filteredCommands, filteredSkills, filteredModels])

    // 工具箱聚焦 - 只在打开时重置
    const prevToolboxOpen = useRef(false)
    useEffect(() => {
        if (isToolboxOpen && !prevToolboxOpen.current) {
            // 从关闭到打开时，重置焦点到搜索框
            setFocusArea({ type: 'search' })
            setSelectedItemIndex(0)
        }
        prevToolboxOpen.current = isToolboxOpen
    }, [isToolboxOpen])

    // 斜杠命令模式下，输入变化时自动匹配并设置焦点
    const prevInputRef = useRef(input)
    useEffect(() => {
        // 只有当 input 真正变化时才处理
        if (prevInputRef.current === input) return
        prevInputRef.current = input

        // 斜杠模式下，如果输入变为空，关闭工具箱
        if (isToolboxOpen && toolboxOpenMode === 'slash' && !input) {
            setIsToolboxOpen(false)
            setToolboxSearchQuery("")
            setFocusArea({ type: 'search' })
            return
        }

        if (isToolboxOpen && toolboxOpenMode === 'slash' && input.startsWith('/')) {
            const match = findSlashMatch()
            if (match) {
                setFocusArea(match)
            } else if (filterTerms.length > 0) {
                // 有过滤词但无匹配时，清除工具栏焦点，回到搜索框
                setFocusArea({ type: 'search' })
            }
        }
    }, [input, isToolboxOpen, toolboxOpenMode, findSlashMatch, filterTerms])

    // 工具箱搜索框中的斜杠命令匹配
    const prevSearchQueryRef = useRef(toolboxSearchQuery)
    useEffect(() => {
        // 只有当 toolboxSearchQuery 真正变化时才处理
        if (prevSearchQueryRef.current === toolboxSearchQuery) return
        prevSearchQueryRef.current = toolboxSearchQuery
        
        if (isToolboxOpen && toolboxSearchQuery.startsWith('/')) {
            const match = findSlashMatch()
            if (match) {
                setFocusArea(match)
            } else if (toolboxSearchQuery === '/') {
                // 只输入了 /，默认聚焦到第一个工具栏按钮
                setFocusArea({ type: 'toolbar', index: 0 })
            } else {
                // 有输入但无匹配，清除工具栏焦点
                setFocusArea({ type: 'search' })
            }
        } else if (isToolboxOpen && !toolboxSearchQuery) {
            // 搜索框清空时，回到搜索框
            setFocusArea({ type: 'search' })
        }
    }, [toolboxSearchQuery, isToolboxOpen, findSlashMatch, filterTerms])

    // 点击外部关闭工具箱（由 Toolbox 组件内部处理）

    // 加载状态
    const isLoading = (status === "streaming" || status === "submitted") && !error
    const isToolbarDisabled = isLoading

    // 自动调整高度并检测是否需要多行模式
    // 这个函数会在所有输入变化时调用（包括 handleChange、历史导航、示例按钮等）
    const adjustTextareaHeight = useCallback(() => {
        const textarea = textareaRef.current
        if (!textarea) return
        
        // 调整高度
        textarea.style.height = "auto"
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
        
        // 检测是否需要切换到多行模式
        // 条件：单行模式 + 有内容 + 内容超出单行高度
        if (!isMultiLineMode && textarea.value.length > 0) {
            // 临时移除高度限制来测量真实内容高度
            const originalStyle = textarea.style.cssText
            textarea.style.height = 'auto'
            textarea.style.maxHeight = 'none'
            textarea.style.overflow = 'hidden'
            
            const needsMultiLine = textarea.scrollHeight > 40
            
            // 恢复原样式
            textarea.style.cssText = originalStyle
            // 重新设置正确的高度
            textarea.style.height = "auto"
            textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
            
            if (needsMultiLine) {
                setIsMultiLineMode(true)
            }
        }
    }, [isMultiLineMode])

    useEffect(() => {
        adjustTextareaHeight()
    }, [input, adjustTextareaHeight])

    // 命令点击处理
    const handleCommandClick = useCallback((cmd: Command) => {
        if (!cmd.enabled) return
        setIsToolboxOpen(false)
        setToolboxSearchQuery("")

        // 如果当前输入以/开头，替换为命令，否则直接插入
        const currentValue = input
        const newValue = currentValue.startsWith("/") 
            ? `${cmd.label} `
            : `${currentValue}${cmd.label} `
        
        const syntheticEvent = {
            target: { value: newValue },
        } as any
        onChange(syntheticEvent)
        
        // 聚焦到输入框末尾
        requestAnimationFrame(() => {
            if (textareaRef.current) {
                textareaRef.current.focus()
                const len = newValue.length
                textareaRef.current.selectionStart = len
                textareaRef.current.selectionEnd = len
            }
        })
    }, [onChange, input])

    // 统一的可选项点击处理
    const handleSelectableItemClick = useCallback((item: ToolboxSelectableItem) => {
        if (item.type === "command") {
            handleCommandClick(item as Command)
        } else if (item.type === "skill") {
            // 切换引擎
            const skill = item as Skill
            if (!skill.isCurrent && onSkillSelect) {
                onSkillSelect(skill.id)
            }
            setIsToolboxOpen(false)
            setToolboxSearchQuery("")
            // 清除输入框中的 / 前缀
            const syntheticEvent = {
                target: { value: "" },
            } as any
            onChange(syntheticEvent)
            requestAnimationFrame(() => {
                textareaRef.current?.focus()
            })
        } else if (item.type === "model") {
            // 选择模型
            const model = item as ModelItem
            if (onModelSelect) {
                onModelSelect(model.id)
            }
            setIsToolboxOpen(false)
            setToolboxSearchQuery("")
            // 清除输入框中的 / 前缀
            const syntheticEvent = {
                target: { value: "" },
            } as any
            onChange(syntheticEvent)
            requestAnimationFrame(() => {
                textareaRef.current?.focus()
            })
        }
    }, [handleCommandClick, onSkillSelect, onModelSelect, onChange])

    // 关闭工具箱（提前定义，供 handleKeyDown 使用）
    const closeToolbox = useCallback(() => {
        setIsToolboxOpen(false)
        setToolboxSearchQuery("")
        textareaRef.current?.focus()
    }, [])

    // 输入变化处理
    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e)
        // adjustTextareaHeight 会在 useEffect 中通过 input 变化自动触发
        // 它会同时处理高度调整和多行模式检测

        const value = e.target.value
        
        // 斜杠命令模式：输入内容不同步到搜索框，而是用于模糊匹配
        // 搜索框内容由 Toolbox 组件自己管理

        // 检测是否应该切换到单行模式：没有任何字符时退回单行
        if (value.length === 0 && files.length === 0) {
            setIsMultiLineMode(false)
            // 关闭工具箱
            setIsToolboxOpen(false)
            setToolboxSearchQuery("")
            setFocusArea({ type: 'search' })
            // 切换到单行后聚焦输入框
            requestAnimationFrame(() => {
                textareaRef.current?.focus()
            })
        }
        // 多行模式检测已移至 adjustTextareaHeight，会在 useEffect 中自动触发
    }, [onChange, files.length])

    // 键盘事件处理
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        // Shift + Enter 发送
        if (e.shiftKey && e.key === "Enter") {
            e.preventDefault()
            const form = e.currentTarget.closest("form")
            if (form && input.trim() && !isLoading) {
                form.requestSubmit()
            }
            return
        }

        // Enter 换行（单行模式 -> 多行模式）
        // 工具箱打开时不处理，留给工具箱处理
        if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !isToolboxOpen) {
            if (!isMultiLineMode) {
                // 单行模式下，Enter 切换到多行模式
                e.preventDefault()
                setIsMultiLineMode(true)
                // 添加换行并聚焦到第二行
                const newValue = input + "\n"
                const syntheticEvent = {
                    target: { value: newValue },
                } as any
                onChange(syntheticEvent)
                // 确保光标在换行后的位置
                requestAnimationFrame(() => {
                    if (textareaRef.current) {
                        const len = newValue.length
                        textareaRef.current.selectionStart = len
                        textareaRef.current.selectionEnd = len
                        textareaRef.current.focus()
                    }
                })
            }
            // 多行模式下，不阻止默认行为，让换行正常发生
            return
        }

        // Cmd/Ctrl + Enter 也可以发送
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault()
            const form = e.currentTarget.closest("form")
            if (form && input.trim() && !isLoading) {
                form.requestSubmit()
            }
            return
        }

        // Backspace 处理
        if (e.key === "Backspace") {
            const textarea = textareaRef.current
            if (textarea) {
                const { selectionStart, selectionEnd, value } = textarea
                if (selectionStart === selectionEnd) {
                    // 多行模式下，内容为空时退回单行模式
                    if (isMultiLineMode && value === "") {
                        e.preventDefault()
                        setIsMultiLineMode(false)
                        requestAnimationFrame(() => {
                            textareaRef.current?.focus()
                        })
                        return
                    }

                    // 快捷删除命令
                    const prefix = value.slice(0, selectionStart)
                    const match = prefix.match(/^\/\S+\s$/)
                    if (match) {
                        e.preventDefault()
                        const newValue = value.slice(selectionStart)
                        const syntheticEvent = {
                            target: { value: newValue },
                        } as any
                        onChange(syntheticEvent)
                        setIsToolboxOpen(false)
                        setToolboxSearchQuery("")
                        setSelectedItemIndex(0)
                        requestAnimationFrame(() => {
                            if (textareaRef.current) {
                                textareaRef.current.selectionStart = 0
                                textareaRef.current.selectionEnd = 0
                            }
                            adjustTextareaHeight()
                        })
                        return
                    }
                }
            }
        }

        // "/" 或 "、" 在行首位置打开工具箱
        if (e.key === "/" || e.key === "、") {
            const textarea = textareaRef.current
            if (!textarea) return

            const { selectionStart, value } = textarea
            
            // 检测是否在行首：
            // 1. 输入框完全为空
            // 2. 光标位置是 0
            // 3. 光标前一个字符是换行符（多行模式下新行的第一个字符）
            const isAtLineStart = 
                value === "" ||
                selectionStart === 0 ||
                (selectionStart > 0 && value[selectionStart - 1] === "\n")
            
            if (isAtLineStart) {
                e.preventDefault()
                // 打开工具箱，标记为斜杠模式
                setIsToolboxOpen(true)
                setToolboxOpenMode('slash')
                setToolboxSearchQuery("")
                setSelectedItemIndex(0)
                
                // 将、转为/，并插入到当前光标位置
                const newValue = value.slice(0, selectionStart) + "/" + value.slice(selectionStart)
                const syntheticEvent = {
                    target: { value: newValue },
                } as any
                onChange(syntheticEvent)
                
                // 确保光标在插入的 / 后面
                requestAnimationFrame(() => {
                    if (textareaRef.current) {
                        textareaRef.current.focus()
                        const newPos = selectionStart + 1
                        textareaRef.current.selectionStart = newPos
                        textareaRef.current.selectionEnd = newPos
                    }
                })
            }
        }

        // 工具箱打开时，所有键盘导航交给工具箱处理
        if (isToolboxOpen) {
            // ESC 在搜索框焦点时只是将光标退回输入框，不关闭工具箱
            // 在其他焦点时关闭工具箱
            if (e.key === "Escape") {
                e.preventDefault()
                if (focusArea.type === 'search') {
                    // 搜索框焦点时，只将光标退回输入框
                    textareaRef.current?.focus()
                } else {
                    // 其他焦点时，关闭工具箱
                    closeToolbox()
                    // 清除输入框中的 / 前缀
                    if (input.startsWith('/')) {
                        const syntheticEvent = {
                            target: { value: '' },
                        } as any
                        onChange(syntheticEvent)
                    }
                }
                return
            }
            
            // Backspace 在搜索框为空时将光标退回输入框（仅非斜杠模式）
            // 斜杠模式下 Backspace 应该正常删除用户输入框内容
            if (e.key === 'Backspace' && focusArea.type === 'search' && !toolboxSearchQuery && toolboxOpenMode !== 'slash') {
                e.preventDefault()
                textareaRef.current?.focus()
                return
            }
            
            // 方向键和 Enter 键在工具箱打开时转发给工具箱处理
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
                e.preventDefault()
                // 通过 ref 调用 Toolbox 的键盘处理函数
                toolboxKeyHandlerRef.current?.(e)
                return
            }
        }

        // 历史导航（工具箱未打开时）
        if (
            !isToolboxOpen &&
            (e.key === "ArrowUp" || e.key === "ArrowDown") &&
            !e.shiftKey &&
            !e.altKey &&
            !e.metaKey &&
            !e.ctrlKey
        ) {
            const textarea = textareaRef.current
            if (!textarea) return

            const { selectionStart, value } = textarea
            const isMultiline = value.includes("\n")

            if (isMultiline) {
                if (e.key === "ArrowUp") {
                    const beforeCursor = value.substring(0, selectionStart)
                    const isOnFirstLine = !beforeCursor.includes("\n")
                    if (!isOnFirstLine) return
                } else if (e.key === "ArrowDown") {
                    const afterCursor = value.substring(selectionStart)
                    const isOnLastLine = !afterCursor.includes("\n")
                    if (!isOnLastLine) return
                }
            }

            let nextValue: string | null | undefined
            if (e.key === "ArrowUp") {
                nextValue = onHistoryPrev?.()
            } else {
                nextValue = onHistoryNext?.()
            }
            if (nextValue !== undefined && nextValue !== null) {
                e.preventDefault()
                const syntheticEvent = {
                    target: { value: nextValue },
                } as any
                onChange(syntheticEvent)
                requestAnimationFrame(() => {
                    if (textareaRef.current) {
                        const len = nextValue.length
                        textareaRef.current.selectionStart = len
                        textareaRef.current.selectionEnd = len
                        adjustTextareaHeight()
                    }
                })
            }
        }
    }, [input, isLoading, isMultiLineMode, onChange, onHistoryPrev, onHistoryNext, adjustTextareaHeight, isToolboxOpen, toolboxSearchQuery, selectableItems, selectedItemIndex, handleSelectableItemClick, closeToolbox, focusArea, filteredCommands, filteredSkills, filteredModels])

    // 粘贴处理
    const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
        if (isLoading) return

        const items = e.clipboardData.items
        const imageItems = Array.from(items).filter((item) =>
            item.type.startsWith("image/"),
        )

        if (imageItems.length > 0) {
            const imageFiles = (
                await Promise.all(
                    imageItems.map(async (item, index) => {
                        const file = item.getAsFile()
                        if (!file) return null
                        return new File(
                            [file],
                            `pasted-image-${Date.now()}-${index}.${file.type.split("/")[1]}`,
                            { type: file.type },
                        )
                    }),
                )
            ).filter((f): f is File => f !== null)

            const { validFiles, errors } = validateFiles(
                imageFiles,
                files.length,
                dict,
            )
            showValidationErrors(errors, dict)
            if (validFiles.length > 0) {
                onFileChange([...files, ...validFiles])
                // 有图片时自动切换到多行模式
                setIsMultiLineMode(true)
            }
        }

        // 检查粘贴的文本是否包含换行符
        const text = e.clipboardData.getData("text")
        if (text && text.includes("\n")) {
            setIsMultiLineMode(true)
        }
    }, [isLoading, files, onFileChange, dict])

    // 文件选择处理
    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newFiles = Array.from(e.target.files || [])
        const { validFiles, errors } = validateFiles(
            newFiles,
            files.length,
            dict,
        )
        showValidationErrors(errors, dict)
        if (validFiles.length > 0) {
            onFileChange([...files, ...validFiles])
            // 有文件时自动切换到多行模式
            setIsMultiLineMode(true)
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }, [files, onFileChange, dict])

    // 删除文件
    const handleRemoveFile = useCallback((fileToRemove: File) => {
        onFileChange(files.filter((file) => file !== fileToRemove))
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }, [files, onFileChange])

    // 触发文件选择
    const triggerFileInput = useCallback(() => {
        fileInputRef.current?.click()
    }, [])

    // 拖拽处理
    const handleDragOver = useCallback((e: React.DragEvent<HTMLFormElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLFormElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent<HTMLFormElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        if (isLoading) return

        const droppedFiles = e.dataTransfer.files
        const supportedFiles = Array.from(droppedFiles).filter((file) =>
            isValidFileType(file),
        )

        const { validFiles, errors } = validateFiles(
            supportedFiles,
            files.length,
            dict,
        )
        showValidationErrors(errors, dict)
        if (validFiles.length > 0) {
            onFileChange([...files, ...validFiles])
            // 有文件时自动切换到多行模式
            setIsMultiLineMode(true)
        }
    }, [isLoading, files, onFileChange, dict])

    // URL 提取
    const handleUrlExtract = useCallback(async (url: string) => {
        if (!onUrlChange) return

        setIsExtractingUrl(true)

        try {
            const existing = urlData
                ? new Map(urlData)
                : new Map<string, UrlData>()
            existing.set(url, {
                url,
                title: url,
                content: "",
                charCount: 0,
                isExtracting: true,
            })
            onUrlChange(existing)

            const data = await extractUrlContent(url)

            const newUrlData = new Map(existing)
            newUrlData.set(url, data)
            onUrlChange(newUrlData)

            setShowUrlDialog(false)
        } catch (error) {
            showErrorToast(
                <span className="text-muted-foreground">
                    {error instanceof Error
                        ? error.message
                        : "Failed to extract URL content"}
                </span>,
            )
        } finally {
            setIsExtractingUrl(false)
        }
    }, [urlData, onUrlChange])

    // 删除 URL
    const handleRemoveUrl = useCallback((url: string) => {
        if (!onUrlChange || !urlData) return
        const next = new Map(urlData)
        next.delete(url)
        onUrlChange(next)
    }, [urlData, onUrlChange])

    // 切换版本列表
    const toggleVersionList = useCallback(() => {
        setShowVersionList(!showVersionList)
    }, [showVersionList])

    // 切换模型列表
    const toggleModelList = useCallback(() => {
        setShowModelList(!showModelList)
    }, [showModelList])

    // 切换工具箱
    const toggleToolbox = useCallback(() => {
        setIsToolboxOpen((prev) => !prev)
        setToolboxSearchQuery("")
        setSelectedItemIndex(0)
        if (!isToolboxOpen) {
            // 点击按钮打开时，标记为 button 模式
            setToolboxOpenMode('button')
            // 工具箱内部会自己处理聚焦
        } else {
            textareaRef.current?.focus()
        }
    }, [isToolboxOpen])

    // 工具箱搜索框键盘导航（统一列表）
    const handleToolboxKeyDown = useCallback((e: React.KeyboardEvent) => {
        const maxIndex = selectableItems.length - 1
        if (e.key === "ArrowDown") {
            e.preventDefault()
            setSelectedItemIndex((idx) =>
                Math.min(idx + 1, Math.max(0, maxIndex)),
            )
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setSelectedItemIndex((idx) => Math.max(0, idx - 1))
        } else if (e.key === "Enter") {
            e.preventDefault()
            const item = selectableItems[selectedItemIndex]
            if (item) handleSelectableItemClick(item)
        } else if (e.key === "Escape") {
            closeToolbox()
        }
    }, [selectableItems, selectedItemIndex, handleSelectableItemClick, closeToolbox])

    // 聚焦输入框
    const focusTextarea = useCallback(() => {
        textareaRef.current?.focus()
    }, [])

    return {
        // Refs
        textareaRef,
        fileInputRef,
        commandInputRef,
        commandPaletteRef,
        slashButtonRef,

        // 状态
        isLoading,
        isToolbarDisabled,
        isDragging,
        showVersionList,
        showModelList,
        showUrlDialog,
        isExtractingUrl,
        isToolboxOpen,
        isMultiLineMode,
        toolboxSearchQuery,
        toolboxOpenMode,
        selectedItemIndex,
        focusArea,

        // 命令和可选项
        commands,
        skills,
        filteredCommands,
        filteredSkills,
        filteredModels,
        selectableItems,
        filterTerms,
        matchedToolbarIndices,

        // 状态设置
        setShowVersionList,
        setShowModelList,
        setShowUrlDialog,
        setIsToolboxOpen,
        setToolboxSearchQuery,
        setToolboxOpenMode,
        setSelectedItemIndex,
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
        handleUrlExtract,
        handleRemoveUrl,
        handleCommandClick,
        handleSelectableItemClick,
        handleToolboxKeyDown,

        // 操作
        toggleVersionList,
        toggleModelList,
        toggleToolbox,
        closeToolbox,
        focusTextarea,

        // 字典
        dict,
    }
}

export { isValidFileType, MAX_FILES, MAX_IMAGE_SIZE }
