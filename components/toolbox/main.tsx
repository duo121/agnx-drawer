"use client"

import {
    AlertTriangle,
    Check,
    ChevronDown,
    ChevronUp,
    CornerDownLeft,
    Download,
    GripHorizontal,
    Link,
    Loader2,
    Minus,
    Plus,
    X
} from "lucide-react"
import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from "react"
import { toast } from "sonner"
import { ButtonWithTooltip } from "@/components/button-with-tooltip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubviewHeader, SearchInput, SearchInputContainer } from "@/components/ui/subview-header"
import { Switch } from "@/components/ui/switch"
import { useEngine } from "@/hooks/engines/engine-context"
import { useDictionary } from "@/hooks/use-dictionary"
import { useToolboxState, ZOOM_LEVELS, MIN_HEIGHT, MAX_HEIGHT_VH } from "@/hooks/use-toolbox-state"
import { ToolboxHeader } from "./header"
import { ToolboxConfigView } from "./config-view"
import { RestoreConfirmDialog } from "@/components/history/restore-confirm-dialog"
import { DeleteConfirmDialog } from "@/components/history/delete-confirm-dialog"
import { SessionDetailDialog } from "@/components/history/session-detail-dialog"
import type { UseModelConfigReturn } from "@/hooks/use-model-config"
import type { FlattenedModel, ProviderConfig, ProviderName } from "@/shared/types/model-config"
import { cn } from "@/shared/utils"
import { TOOLBAR_BUTTON_KEYWORDS, type ToolbarButtonKeywords } from "@/shared/toolbox-keywords"

// ============ 类型定义 ============

// 焦点区域类型
export type FocusArea = 
    | { type: 'search' }
    | { type: 'toolbar'; index: number }
    | { type: 'list'; section: 'commands' | 'skills' | 'models'; index: number }
    | { type: 'history'; index: number }

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

type ToolboxView = "main" | "history" | "export" | "url" | "config"

// 按钮配置类型（兼容旧代码，同时支持 keywords）
export interface ToolbarButtonConfig {
    key: string
    command: string
    tooltip: string
    keywords?: string[]
    isVisible?: () => boolean
}

// Provider Logo 映射
const PROVIDER_LOGO_MAP: Record<string, string> = {
    openai: "openai",
    anthropic: "anthropic",
    google: "google",
    azure: "azure",
    bedrock: "amazon-bedrock",
    openrouter: "openrouter",
    deepseek: "deepseek",
    siliconflow: "siliconflow",
    dashscope: "alibaba-cloud",
    doubao: "bytedance",
    modelscope: "modelscope",
    zhipu: "zhipu",
}

// 按钮组配置（从统一的关键词配置中生成）
const TOOLBAR_BUTTONS: ToolbarButtonConfig[] = TOOLBAR_BUTTON_KEYWORDS.map(btn => ({
    key: btn.key,
    command: btn.command,
    tooltip: btn.tooltip,
    keywords: btn.keywords,
}))

// ============ 工具函数 ============

// 格式化相对时间
function formatRelativeTime(timestamp?: number): string {
    if (!timestamp) return ""

    const now = Date.now()
    const diff = now - timestamp
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (seconds < 60) {
        return "just now"
    } else if (minutes < 60) {
        return `${minutes}m`
    } else if (hours < 24) {
        return `${hours}h`
    } else if (days === 1) {
        return "yesterday"
    } else if (days < 7) {
        return `${days}d`
    } else {
        const date = new Date(timestamp)
        return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    }
}

// ============ Props 定义 ============

export interface ToolboxProps {
    // 搜索
    searchQuery: string
    onSearchChange: (query: string) => void

    // 统一可选项列表
    filteredCommands: Command[]
    filteredSkills: Skill[]
    filteredModels: ModelItem[]
    selectableItems: ToolboxSelectableItem[]
    selectedItemIndex: number
    onSelectableItemClick: (item: ToolboxSelectableItem) => void
    onKeyDown: (e: React.KeyboardEvent) => void

    // 模型
    models: FlattenedModel[]
    selectedModelId: string | undefined
    onModelSelect: (modelId: string | undefined) => void
    showUnvalidatedModels: boolean

    // 模型配置
    modelConfig: UseModelConfigReturn

    // 工具箱打开方式
    toolboxOpenMode: 'button' | 'slash'

    // 过滤词数组（用于高亮匹配的工具栏按钮）
    filterTerms?: string[]
    // 匹配的工具栏按钮索引
    matchedToolbarIndices?: number[]

    // 焦点管理
    focusArea: FocusArea
    onFocusChange: (area: FocusArea) => void

    // 文件上传
    onUploadFile: () => void

    // URL 提取
    onUrlChange?: (data: Map<string, any>) => void
    urlData?: Map<string, any>

    // 控制
    onClose: () => void
    // 将焦点退回用户输入框（不关闭工具箱）
    onFocusBack?: () => void
    // 是否禁用点击外部关闭（当有 Dialog 打开时）
    disableClickOutside?: boolean

    // 历史会话
    sessions?: Array<{
        id: string
        title: string
        updatedAt: number
        thumbnailDataUrl?: string
        activeEngineId?: string
        hasDrawio?: boolean
        hasExcalidraw?: boolean
        messageCount?: number
    }>
    // 过滤后的历史会话（由统一的 useToolboxFilter 计算）
    filteredSessions?: Array<{
        id: string
        title: string
        updatedAt: number
        thumbnailDataUrl?: string
        activeEngineId?: string
        hasDrawio?: boolean
        hasExcalidraw?: boolean
        messageCount?: number
    }>
    currentSessionId?: string | null
    onSessionSwitch?: (id: string) => void
    onSessionDelete?: (id: string) => void
    onSessionCreate?: () => void
    onSessionRename?: (id: string, newTitle: string) => void
}

export interface ToolboxRef {
    focus: () => void
    handleKeyDown: (e: React.KeyboardEvent) => void
}

// ============ 主组件 ============

export const Toolbox = forwardRef<ToolboxRef, ToolboxProps>(
    function Toolbox(props, ref) {
        const {
            searchQuery,
            onSearchChange,
            // 统一可选项列表
            filteredCommands,
            filteredSkills,
            filteredModels,
            selectableItems,
            selectedItemIndex,
            onSelectableItemClick,
            onKeyDown,
            // 模型
            models,
            selectedModelId,
            onModelSelect,
            showUnvalidatedModels,
            modelConfig,
            toolboxOpenMode,
            // 过滤词和匹配的工具栏按钮
            filterTerms = [],
            matchedToolbarIndices = [],
            // 焦点管理
            focusArea,
            onFocusChange,
            onUploadFile,
            onUrlChange,
            urlData,
            onClose,
            onFocusBack,
            disableClickOutside = false,
            // 历史会话
            sessions = [],
            filteredSessions: filteredSessionsProp,
            currentSessionId: currentSessionIdProp,
            onSessionSwitch,
            onSessionDelete,
            onSessionCreate,
            onSessionRename,
        } = props

        // 使用传入的 filteredSessions，如果没有则退回 sessions
        const filteredSessions = filteredSessionsProp ?? sessions

        const dict = useDictionary()
        const searchInputRef = useRef<HTMLInputElement>(null)
        const containerRef = useRef<HTMLDivElement>(null)
        const toolbarButtonRefs = useRef<(HTMLButtonElement | null)[]>([])

        // 从 EngineContext 获取历史版本相关数据
        const {
            engineId,
            // Excalidraw
            excalidrawHistory,
            pushExcalidrawHistory,
            deleteExcalidrawVersion,
            getExcalidrawScene,
            setExcalidrawScene,
            appendExcalidrawElements,
            // DrawIO
            diagramHistory,
            pushDrawioHistory,
            deleteDrawioHistory,
            loadDiagram,
            latestSvg,
            chartXML,
            // 画布变化通知
            notifyCanvasChange,
            // 保存图表
            saveDiagramToFile,
        } = useEngine()

        const isExcalidraw = engineId === "excalidraw"

        // ============ 状态 ============

        const state = useToolboxState()
        const {
            currentView,
            setCurrentView,
            height,
            setHeight,
            versionZoomLevel,
            setVersionZoomLevel,
            sessionZoomLevel,
            setSessionZoomLevel,
            historyLayout,
            toggleHistoryLayout,
            sessionLayout,
            toggleSessionLayout,
            saveFilename,
            setSaveFilename,
            saveFormat,
            setSaveFormat,
            urlInput,
            setUrlInput,
            isExtractingUrl,
            setIsExtractingUrl,
            selectedProviderId,
            setSelectedProviderId,
            showApiKey,
            setShowApiKey,
            validationStatus,
            setValidationStatus,
            validationError,
            setValidationError,
            customModelInput,
            setCustomModelInput,
            duplicateError,
            setDuplicateError,
            validatingModelIndex,
            setValidatingModelIndex,
            providerDeleteConfirm,
            setProviderDeleteConfirm,
            validationResetTimeoutRef,
            isDragging,
            setIsDragging,
            dragStartY,
            dragStartHeight,
            tooltipPosition,
            setTooltipPosition,
        } = state

        // 确认恢复对话框状态
        const [restoreConfirmDialog, setRestoreConfirmDialog] = useState<{
            isOpen: boolean
            versionIndex: number
        }>({
            isOpen: false,
            versionIndex: -1,
        })

        // 删除确认对话框状态
        const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
            isOpen: boolean
            versionIndex: number
        }>({
            isOpen: false,
            versionIndex: -1,
        })


        // 会话详情弹框状态
        const [sessionDetailDialog, setSessionDetailDialog] = useState<{
            isOpen: boolean
            session: {
                id: string
                title: string
                updatedAt: number
                thumbnailDataUrl?: string
                activeEngineId?: string
                hasDrawio?: boolean
                hasExcalidraw?: boolean
                messageCount?: number
            } | null
        }>({
            isOpen: false,
            session: null,
        })

        // 动态计算工具箱可用的最大高度
        const [maxAvailableHeight, setMaxAvailableHeight] = useState<number | null>(null)

        // ============ 计算值 ============

        const historyItems = isExcalidraw ? excalidrawHistory : diagramHistory
        const itemsPerRow = ZOOM_LEVELS[versionZoomLevel]

        // 计算每个 section 的起始索引（用于高亮映射）
        const commandsStartIndex = 0
        const skillsStartIndex = filteredCommands.length
        const modelsStartIndex = filteredCommands.length + filteredSkills.length

        // 当前选中的模型名称（缩略）
        const selectedModelName = useMemo(() => {
            const model = models.find((m) => m.id === selectedModelId)
            if (!model) return dict.modelConfig.default
            // 缩略显示
            const name = model.modelId
            return name.length > 12 ? name.slice(0, 12) + "..." : name
        }, [models, selectedModelId, dict])

        // 可见的工具栏按钮列表（过滤掉不可见的）
        const visibleToolbarButtons = useMemo(() => {
            return TOOLBAR_BUTTONS.filter(btn => {
                // URL 按钮只在有 onUrlChange 时显示
                if (btn.key === 'url') return !!onUrlChange
                return true
            })
        }, [onUrlChange])

        // ============ 初始化 ============

        // 聚焦搜索框
        useEffect(() => {
            if (currentView === "main") {
                searchInputRef.current?.focus()
            }
        }, [currentView])

        // 自动滚动到聚焦项
        useEffect(() => {
            if (currentView !== "main") return
            if (focusArea.type === 'search' || focusArea.type === 'toolbar') return
            const selectedEl = containerRef.current?.querySelector('[data-selected="true"]')
            if (selectedEl) {
                selectedEl.scrollIntoView({ block: "nearest", behavior: "smooth" })
            }
        }, [focusArea, currentView])

        // ============ 点击外部关闭 ============

        useEffect(() => {
            const handleClickOutside = (e: MouseEvent | TouchEvent) => {
                const target = e.target as Node
                const element = target as Element
                
                // 检查是否点击在工具箱内部
                const isInContainer = containerRef.current?.contains(target)
                
                // 检查是否点击在任何 Portal 内容中（Select、Dialog、Popover 等）
                const isInPortal = element.closest('[data-radix-popper-content-wrapper]') !== null ||
                                  element.closest('[data-radix-select-content]') !== null ||
                                  element.closest('[data-radix-dialog-content]') !== null ||
                                  element.closest('[data-radix-popover-content]') !== null ||
                                  element.closest('[role="dialog"]') !== null ||
                                  element.closest('[role="menu"]') !== null ||
                                  element.closest('[role="listbox"]') !== null
                
                console.log('[Toolbox] Click detected:', {
                    target: target,
                    isInContainer,
                    isInPortal,
                    disableClickOutside
                })
                
                // 如果点击在工具箱内部或 Portal 内容中，不关闭
                if (isInContainer || isInPortal) {
                    return
                }
                
                // 如果禁用点击外部关闭（有 Dialog 打开），不关闭
                if (disableClickOutside) {
                    console.log('[Toolbox] Click outside disabled - dialog is open')
                    return
                }
                
                console.log('[Toolbox] Click outside detected - closing toolbox')
                onClose()
            }

            const timer = setTimeout(() => {
                document.addEventListener("mousedown", handleClickOutside)
                document.addEventListener("touchstart", handleClickOutside)
            }, 0)

            return () => {
                clearTimeout(timer)
                document.removeEventListener("mousedown", handleClickOutside)
                document.removeEventListener("touchstart", handleClickOutside)
            }
        }, [onClose, disableClickOutside])

        // ============ 高度拖拽 ============

        const handleDragStart = useCallback(
            (e: React.MouseEvent) => {
                e.preventDefault()
                setIsDragging(true)
                dragStartY.current = e.clientY
                dragStartHeight.current = height
            },
            [height]
        )

        useEffect(() => {
            if (!isDragging) return

            const handleMouseMove = (e: MouseEvent) => {
                // 使用动态计算的最大可用高度，如果没有则使用视口高度的 90%
                const maxHeight = maxAvailableHeight || window.innerHeight * MAX_HEIGHT_VH
                const delta = dragStartY.current - e.clientY
                const newHeight = Math.min(
                    maxHeight,
                    Math.max(MIN_HEIGHT, dragStartHeight.current + delta)
                )
                setHeight(newHeight)
            }

            const handleMouseUp = () => {
                setIsDragging(false)
                // 高度保存由 useToolboxSession 在 isDragging 变化时自动处理
            }

            document.addEventListener("mousemove", handleMouseMove)
            document.addEventListener("mouseup", handleMouseUp)

            return () => {
                document.removeEventListener("mousemove", handleMouseMove)
                document.removeEventListener("mouseup", handleMouseUp)
            }
        }, [isDragging, height, maxAvailableHeight])

        // ============ 历史版本操作 ============

        // 手动保存版本
        const handleSaveVersion = async () => {
            if (isExcalidraw) {
                const scene = getExcalidrawScene()
                if (!scene?.elements?.length) {
                    toast.error("没有可保存的内容")
                    return
                }
                await pushExcalidrawHistory("手动保存", true)
                toast.success("已保存历史版本")
            } else {
                // DrawIO: 使用 isRealDiagram 检查
                const { isRealDiagram } = await import("@/shared/utils")
                if (!latestSvg || !isRealDiagram(chartXML)) {
                    toast.error("没有可保存的内容")
                    return
                }
                pushDrawioHistory(true)
                toast.success("已保存历史版本")
            }
            // 切换到主视图以显示新保存的版本
            setCurrentView("main")
        }

        // 直接恢复版本
        const restoreVersion = useCallback(async (index: number) => {
            console.log('[Toolbox] restoreVersion called, index:', index, 'isExcalidraw:', isExcalidraw)
            if (isExcalidraw) {
                const entry = excalidrawHistory[index]
                console.log('[Toolbox] excalidraw entry:', entry)
                if (entry?.scene) {
                    const baseAppState = getExcalidrawScene()?.appState || {}

                    const safeScene = {
                        elements: entry.scene.elements || [],
                        appState: {
                            ...baseAppState,
                            collaborators: new Map(),
                        },
                        files: entry.scene.files || {},
                    }
                    // 使用 commitToHistory: true 让这次恢复可以被 Ctrl+Z 撤销
                    await setExcalidrawScene(safeScene, { commitToHistory: true })
                    notifyCanvasChange()
                }
            } else {
                const entry = diagramHistory[index]
                console.log('[Toolbox] drawio entry:', entry)
                if (entry?.xml) {
                    loadDiagram(entry.xml, true)
                    notifyCanvasChange()
                }
            }
        }, [isExcalidraw, excalidrawHistory, diagramHistory, getExcalidrawScene, setExcalidrawScene, loadDiagram, notifyCanvasChange])

        // 保存后恢复
        const saveAndRestoreVersion = useCallback(async (index: number) => {
            // 先保存当前状态
            if (isExcalidraw) {
                const scene = getExcalidrawScene()
                if (scene?.elements?.length) {
                    await pushExcalidrawHistory("手动保存", true)
                }
            } else {
                // DrawIO: 使用 isRealDiagram 检查
                const { isRealDiagram } = await import("@/shared/utils")
                if (latestSvg && isRealDiagram(chartXML)) {
                    pushDrawioHistory(true)
                }
            }
            // 然后恢复选中的版本
            await restoreVersion(index)
        }, [isExcalidraw, getExcalidrawScene, pushExcalidrawHistory, latestSvg, chartXML, pushDrawioHistory, restoreVersion])

        // 选择历史版本 - 打开确认对话框（新功能）
        const handleSelectVersion = useCallback((index: number) => {
            setRestoreConfirmDialog({
                isOpen: true,
                versionIndex: index,
            })
        }, [])

        // 确认对话框 - 直接恢复
        const handleDirectRestore = useCallback(async () => {
            const { versionIndex } = restoreConfirmDialog
            console.log('[Toolbox] handleDirectRestore called, versionIndex:', versionIndex)
            setRestoreConfirmDialog({ isOpen: false, versionIndex: -1 })
            await restoreVersion(versionIndex)
        }, [restoreConfirmDialog, restoreVersion])

        // 确认对话框 - 插入并选中
        const handleInsertAndSelect = useCallback(async () => {
            const { versionIndex } = restoreConfirmDialog
            console.log('[Toolbox] handleInsertAndSelect called, versionIndex:', versionIndex)
            setRestoreConfirmDialog({ isOpen: false, versionIndex: -1 })
            
            if (isExcalidraw) {
                const entry = excalidrawHistory[versionIndex]
                if (entry?.scene?.elements) {
                    // 使用 appendExcalidrawElements 插入元素并选中
                    // 不需要传入 selectIds，函数会自动选中新插入的元素
                    await appendExcalidrawElements(entry.scene.elements)
                    notifyCanvasChange()
                }
            } else {
                // DrawIO 不支持插入，降级为直接恢复
                await restoreVersion(versionIndex)
            }
        }, [restoreConfirmDialog, isExcalidraw, excalidrawHistory, appendExcalidrawElements, restoreVersion, notifyCanvasChange])

        // 确认对话框 - 保存后恢复
        const handleSaveAndRestore = useCallback(async () => {
            const { versionIndex } = restoreConfirmDialog
            console.log('[Toolbox] handleSaveAndRestore called, versionIndex:', versionIndex)
            setRestoreConfirmDialog({ isOpen: false, versionIndex: -1 })
            await saveAndRestoreVersion(versionIndex)
        }, [restoreConfirmDialog, saveAndRestoreVersion])

        // 确认对话框 - 取消
        const handleCancelRestore = useCallback(() => {
            setRestoreConfirmDialog({ isOpen: false, versionIndex: -1 })
        }, [])

        // 确认对话框 - 删除版本
        const handleRestoreDialogDelete = useCallback(() => {
            const { versionIndex } = restoreConfirmDialog
            setRestoreConfirmDialog({ isOpen: false, versionIndex: -1 })
            
            if (isExcalidraw) {
                deleteExcalidrawVersion(versionIndex)
            } else {
                deleteDrawioHistory(versionIndex)
            }
            toast.success("已删除版本")
        }, [restoreConfirmDialog, isExcalidraw, deleteExcalidrawVersion, deleteDrawioHistory])

        // 删除版本 - 打开删除确认对话框
        const handleDeleteVersion = (e: React.MouseEvent, index: number) => {
            e.stopPropagation()
            setDeleteConfirmDialog({
                isOpen: true,
                versionIndex: index,
            })
        }

        // 删除确认对话框 - 确认删除
        const handleConfirmDelete = useCallback(() => {
            const { versionIndex } = deleteConfirmDialog
            setDeleteConfirmDialog({ isOpen: false, versionIndex: -1 })
            
            if (isExcalidraw) {
                deleteExcalidrawVersion(versionIndex)
            } else {
                deleteDrawioHistory(versionIndex)
            }
            toast.success("已删除版本")
        }, [deleteConfirmDialog, isExcalidraw, deleteExcalidrawVersion, deleteDrawioHistory])

        // 删除确认对话框 - 取消
        const handleCancelDelete = useCallback(() => {
            setDeleteConfirmDialog({ isOpen: false, versionIndex: -1 })
        }, [])

        // ============ 会话操作 ============

        // 点击会话 - 打开详情弹框
        const handleSessionClick = useCallback((session: {
            id: string
            title: string
            updatedAt: number
            thumbnailDataUrl?: string
            activeEngineId?: string
            hasDrawio?: boolean
            hasExcalidraw?: boolean
            messageCount?: number
        }) => {
            setSessionDetailDialog({
                isOpen: true,
                session,
            })
        }, [])

        // 会话详情弹框 - 关闭
        const handleCloseSessionDetail = useCallback(() => {
            setSessionDetailDialog({ isOpen: false, session: null })
        }, [])

        // 会话详情弹框 - 切换会话
        const handleSessionDetailSwitch = useCallback(() => {
            const session = sessionDetailDialog.session
            if (session && session.id !== currentSessionIdProp && onSessionSwitch) {
                onSessionSwitch(session.id)
                setSessionDetailDialog({ isOpen: false, session: null })
                onClose()
            }
        }, [sessionDetailDialog.session, currentSessionIdProp, onSessionSwitch, onClose])

        // 会话详情弹框 - 删除会话
        const handleSessionDetailDelete = useCallback(() => {
            const session = sessionDetailDialog.session
            if (session && onSessionDelete) {
                onSessionDelete(session.id)
                toast.success("已删除会话")
            }
        }, [sessionDetailDialog.session, onSessionDelete])

        // 会话详情弹框 - 重命名会话
        const handleSessionDetailRename = useCallback((newTitle: string) => {
            const session = sessionDetailDialog.session
            if (session && onSessionRename) {
                onSessionRename(session.id, newTitle)
                // 更新弹框中的会话标题
                setSessionDetailDialog(prev => ({
                    ...prev,
                    session: prev.session ? { ...prev.session, title: newTitle } : null,
                }))
                toast.success("已更新会话标题")
            }
        }, [sessionDetailDialog.session, onSessionRename])

        // 新建会话
        const handleCreateSession = useCallback(() => {
            if (onSessionCreate) {
                onSessionCreate()
                onClose()
            }
        }, [onSessionCreate, onClose])

        // ============ 保存图表 ============

        const handleSaveDiagram = () => {
            saveDiagramToFile(
                saveFilename,
                saveFormat,
                undefined,
                dict.save.savedSuccessfully
            )
            setCurrentView("main")
        }

        // ============ URL 提取 ============

        const handleUrlExtract = useCallback(
            async (url: string) => {
                if (!onUrlChange) return

                setIsExtractingUrl(true)
                try {
                    // 动态导入 extractUrlContent
                    const { extractUrlContent } = await import("@/shared/extract-content")
                    const data = await extractUrlContent(url)

                    const existing = props.urlData
                        ? new Map(props.urlData)
                        : new Map<string, any>()
                    existing.set(url, data)
                    onUrlChange(existing)

                    setUrlInput("")
                    setCurrentView("main")
                    toast.success("已提取 URL 内容")
                } catch (error) {
                    toast.error(
                        error instanceof Error ? error.message : "提取失败"
                    )
                } finally {
                    setIsExtractingUrl(false)
                }
            },
            [onUrlChange, props.urlData]
        )

        // ============ 视图切换 ============

        const handleBack = () => setCurrentView("main")

        // ============ 工具栏按钮动作映射 ============

        const toolbarActions: Record<string, () => void> = useMemo(() => ({
            save: handleSaveVersion,
            export: () => setCurrentView("export"),
            upload: onUploadFile,
            url: () => setCurrentView("url"),
            model: () => setCurrentView("config"),
        }), [handleSaveVersion, onUploadFile])

        // ============ 键盘导航 ============

        // 计算列表区域的总项数
        const listSections = useMemo(() => {
            const sections: { type: 'commands' | 'skills' | 'models'; items: any[] }[] = []
            if (filteredCommands.length > 0) {
                sections.push({ type: 'commands', items: filteredCommands })
            }
            if (filteredSkills.length > 0) {
                sections.push({ type: 'skills', items: filteredSkills })
            }
            // History 在中间处理
            if (filteredModels.length > 0) {
                sections.push({ type: 'models', items: filteredModels })
            }
            return sections
        }, [filteredCommands, filteredSkills, filteredModels])

        // 键盘导航处理
        const handleToolboxKeyDown = useCallback((e: React.KeyboardEvent) => {
            // 只在主视图处理
            if (currentView !== 'main') return

            const { key } = e

            // Enter 触发当前聚焦项
            if (key === 'Enter') {
                e.preventDefault()
                if (focusArea.type === 'search') {
                    // 聚焦在搜索框时，按回车进入搜索框输入
                    searchInputRef.current?.focus()
                } else if (focusArea.type === 'toolbar') {
                    const btn = visibleToolbarButtons[focusArea.index]
                    if (btn) {
                        toolbarActions[btn.key]?.()
                        // save 和 upload 不需要切换视图，执行后关闭工具箱
                        if (btn.key === 'save' || btn.key === 'upload') {
                            onClose()
                        }
                    }
                } else if (focusArea.type === 'list') {
                    const section = listSections.find(s => s.type === focusArea.section)
                    if (section) {
                        const item = section.items[focusArea.index]
                        if (item) {
                            onSelectableItemClick(item)
                        }
                    }
                } else if (focusArea.type === 'history') {
                    handleSelectVersion(focusArea.index)
                }
                return
            }
            
            // 搜索框焦点时的特殊处理
            if (focusArea.type === 'search') {
                // ESC 或 Backspace（搜索框为空）时将焦点退回用户输入框
                if (key === 'Escape' || (key === 'Backspace' && !searchQuery)) {
                    e.preventDefault()
                    onFocusBack?.()
                    return
                }
            }

            // Escape 关闭
            if (key === 'Escape') {
                e.preventDefault()
                onClose()
                return
            }

            // 方向键导航
            if (key === 'ArrowDown') {
                e.preventDefault()
                if (focusArea.type === 'search' || focusArea.type === 'toolbar') {
                    // 从搜索框/工具栏向下：到第一个列表项
                    if (listSections.length > 0) {
                        onFocusChange({ type: 'list', section: listSections[0].type, index: 0 })
                    } else if (historyItems.length > 0) {
                        onFocusChange({ type: 'history', index: 0 })
                    }
                } else if (focusArea.type === 'list') {
                    // 在列表中向下
                    const currentSectionIdx = listSections.findIndex(s => s.type === focusArea.section)
                    const currentSection = listSections[currentSectionIdx]
                    if (currentSection && focusArea.index < currentSection.items.length - 1) {
                        // 同 section 内向下
                        onFocusChange({ type: 'list', section: focusArea.section, index: focusArea.index + 1 })
                    } else if (currentSectionIdx < listSections.length - 1) {
                        // 到下一个 section
                        // 检查是否需要插入 history
                        const nextSection = listSections[currentSectionIdx + 1]
                        if (currentSection?.type === 'skills' && historyItems.length > 0) {
                            // skills 下面是 history
                            onFocusChange({ type: 'history', index: 0 })
                        } else {
                            onFocusChange({ type: 'list', section: nextSection.type, index: 0 })
                        }
                    } else if (historyItems.length > 0 && focusArea.section !== 'models') {
                        // 列表结束，去 history
                        onFocusChange({ type: 'history', index: 0 })
                    }
                } else if (focusArea.type === 'history') {
                    // 从 history 向下：到 models
                    const modelsSection = listSections.find(s => s.type === 'models')
                    if (modelsSection) {
                        onFocusChange({ type: 'list', section: 'models', index: 0 })
                    }
                }
                return
            }

            if (key === 'ArrowUp') {
                e.preventDefault()
                if (focusArea.type === 'list') {
                    if (focusArea.index > 0) {
                        // 同 section 内向上
                        onFocusChange({ type: 'list', section: focusArea.section, index: focusArea.index - 1 })
                    } else {
                        const currentSectionIdx = listSections.findIndex(s => s.type === focusArea.section)
                        if (focusArea.section === 'models' && historyItems.length > 0) {
                            // models 上面是 history
                            onFocusChange({ type: 'history', index: historyItems.length - 1 })
                        } else if (currentSectionIdx > 0) {
                            // 到上一个 section 的最后一项
                            const prevSection = listSections[currentSectionIdx - 1]
                            onFocusChange({ type: 'list', section: prevSection.type, index: prevSection.items.length - 1 })
                        } else {
                            // 回到搜索框
                            onFocusChange({ type: 'search' })
                            searchInputRef.current?.focus()
                        }
                    }
                } else if (focusArea.type === 'history') {
                    // 从 history 向上：到 skills 最后一项或搜索框
                    const skillsSection = listSections.find(s => s.type === 'skills')
                    if (skillsSection) {
                        onFocusChange({ type: 'list', section: 'skills', index: skillsSection.items.length - 1 })
                    } else {
                        onFocusChange({ type: 'search' })
                        searchInputRef.current?.focus()
                    }
                } else if (focusArea.type === 'toolbar') {
                    // 从工具栏向上：到搜索框
                    onFocusChange({ type: 'search' })
                    searchInputRef.current?.focus()
                }
                return
            }

            if (key === 'ArrowRight') {
                e.preventDefault()
                if (focusArea.type === 'search') {
                    // 从搜索框向右：检查光标位置
                    const input = searchInputRef.current
                    if (input && input.selectionStart === input.value.length) {
                        // 光标在最右，跳到工具栏
                        if (visibleToolbarButtons.length > 0) {
                            onFocusChange({ type: 'toolbar', index: 0 })
                        }
                    }
                } else if (focusArea.type === 'toolbar') {
                    // 工具栏内向右
                    if (focusArea.index < visibleToolbarButtons.length - 1) {
                        onFocusChange({ type: 'toolbar', index: focusArea.index + 1 })
                    }
                } else if (focusArea.type === 'history') {
                    // history 内向右
                    if (focusArea.index < historyItems.length - 1) {
                        onFocusChange({ type: 'history', index: focusArea.index + 1 })
                    }
                }
                return
            }

            if (key === 'ArrowLeft') {
                e.preventDefault()
                if (focusArea.type === 'toolbar') {
                    if (focusArea.index > 0) {
                        onFocusChange({ type: 'toolbar', index: focusArea.index - 1 })
                    } else {
                        // 回到搜索框
                        onFocusChange({ type: 'search' })
                        searchInputRef.current?.focus()
                    }
                } else if (focusArea.type === 'history') {
                    if (focusArea.index > 0) {
                        onFocusChange({ type: 'history', index: focusArea.index - 1 })
                    }
                }
                return
            }
        }, [currentView, focusArea, visibleToolbarButtons, toolbarActions, listSections, historyItems, onFocusChange, onSelectableItemClick, handleSelectVersion, onClose])

        // 暴露方法
        useImperativeHandle(ref, () => ({
            focus: () => searchInputRef.current?.focus(),
            handleKeyDown: handleToolboxKeyDown,
        }), [handleToolboxKeyDown])

        // ============ 渲染 ============

        // 导出图表视图顶部栏
        const renderExportHeader = () => (
            <SubviewHeader onBack={handleBack}>
                <SearchInputContainer>
                    <Input
                        value={saveFilename || ""}
                        onChange={(e) => setSaveFilename(e.target.value)}
                        placeholder="文件名"
                        className="flex-1 h-full border-0 bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
                    />
                </SearchInputContainer>
                <Button size="sm" onClick={handleSaveDiagram} className="h-9 px-4 rounded-xl gap-1.5">
                    <Download className="h-4 w-4" />
                    保存
                </Button>
            </SubviewHeader>
        )

        // URL 提取视图顶部栏
        const renderUrlHeader = () => (
            <SubviewHeader onBack={handleBack}>
                <SearchInputContainer>
                    <Input
                        value={urlInput || ""}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://example.com/page"
                        className="flex-1 h-full border-0 bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && urlInput.trim() && !isExtractingUrl) {
                                handleUrlExtract(urlInput.trim())
                            }
                        }}
                    />
                </SearchInputContainer>
                <Button
                    size="sm"
                    onClick={() => handleUrlExtract(urlInput.trim())}
                    disabled={!urlInput.trim() || isExtractingUrl}
                    className="h-9 px-4 rounded-xl gap-1.5"
                >
                    {isExtractingUrl ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Link className="h-4 w-4" />
                    )}
                    提取
                </Button>
            </SubviewHeader>
        )

        // 版本缩略图
        const renderVersionThumbnail = (
            item: any,
            index: number,
            expanded = false
        ) => {
            const thumbnailUrl = isExcalidraw
                ? item.thumbnailDataUrl
                : item.svg
            const timestamp = item.timestamp
            const isFocused = focusArea.type === 'history' && focusArea.index === index

            return (
                <div
                    key={index}
                    onClick={() => {
                        handleSelectVersion(index)
                    }}
                    className={cn(
                        "relative group cursor-pointer rounded-lg transition-all",
                        item.isManual && "ring-2 ring-green-500 ring-offset-1 ring-offset-muted",
                        // 键盘导航聚焦高亮
                        isFocused && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    )}
                    style={{ aspectRatio: '1 / 1' }}
                >
                    <div className="w-full h-full border border-border/50 rounded-lg overflow-hidden bg-background flex items-center justify-center hover:border-primary/50 transition-colors">
                        {thumbnailUrl ? (
                            <img
                                src={thumbnailUrl}
                                alt="Version"
                                className="object-contain w-full h-full p-0.5"
                            />
                        ) : (
                            <span className="text-[10px] text-muted-foreground">
                                无
                            </span>
                        )}
                    </div>

                    {/* 时间标签 - 底部内部半透明遮罩 */}
                    {!expanded && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 rounded-b-lg">
                            <span className="text-[9px] text-white block text-center py-0.5">
                                {formatRelativeTime(timestamp)}
                            </span>
                        </div>
                    )}
                </div>
            )
        }

        // 会话缩略图
        const renderSessionThumbnail = (
            session: { id: string; title: string; updatedAt: number; thumbnailDataUrl?: string; activeEngineId?: string; hasDrawio?: boolean; hasExcalidraw?: boolean; messageCount?: number },
        ) => {
            const isCurrentSession = session.id === currentSessionIdProp

            return (
                <div
                    key={session.id}
                    onClick={() => handleSessionClick(session)}
                    className={cn(
                        "relative group cursor-pointer rounded-lg transition-all",
                        isCurrentSession && "ring-2 ring-primary ring-offset-1 ring-offset-muted"
                    )}
                    style={{ aspectRatio: '1 / 1' }}
                    title={session.title || "New Chat"}
                >
                    <div className="w-full h-full border border-border/50 rounded-lg overflow-hidden bg-background flex flex-col hover:border-primary/50 transition-colors">
                        {/* 标题 */}
                        <div className="px-2 py-1.5 bg-muted/50 border-b border-border/30">
                            <span className="text-sm text-foreground truncate block font-medium text-center">
                                {session.title || "New Chat"}
                            </span>
                        </div>
                        {/* 缩略图 */}
                        <div className="flex-1 flex items-center justify-center p-0.5">
                            {session.thumbnailDataUrl ? (
                                <img
                                    src={session.thumbnailDataUrl}
                                    alt={session.title}
                                    className="object-contain w-full h-full"
                                />
                            ) : (
                                <span className="text-[10px] text-muted-foreground">
                                    无预览
                                </span>
                            )}
                        </div>
                    </div>

                    {/* 引擎图标徽章 - 左上角：显示会话包含的引擎 */}
                    <div className="absolute -top-1.5 -left-1.5 flex gap-0.5 z-10">
                        {session.hasDrawio && (
                            <div className="rounded-full w-4 h-4 flex items-center justify-center shadow-sm bg-blue-500 text-white">
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="7" height="7" rx="1"/>
                                    <rect x="14" y="3" width="7" height="7" rx="1"/>
                                    <rect x="3" y="14" width="7" height="7" rx="1"/>
                                    <rect x="14" y="14" width="7" height="7" rx="1"/>
                                </svg>
                            </div>
                        )}
                        {session.hasExcalidraw && (
                            <div className="rounded-full w-4 h-4 flex items-center justify-center shadow-sm bg-purple-500 text-white">
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 17.5l5-5 4 4 6-6"/>
                                    <polyline points="16,12 18,10 22,6"/>
                                </svg>
                            </div>
                        )}
                    </div>

                    {/* 时间标签 - 底部内部半透明遮罩 */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 rounded-b-lg">
                        <span className="text-[9px] text-white block text-center py-0.5">
                            {formatRelativeTime(session.updatedAt)}
                        </span>
                    </div>
                </div>
            )
        }

        // 根据引擎获取可用的保存格式
        const saveFormats = useMemo(() => {
            if (isExcalidraw) {
                return [
                    { value: "png" as const, label: "PNG", desc: "图片" },
                    { value: "svg" as const, label: "SVG", desc: "矢量" },
                    { value: "excalidraw" as const, label: "Excalidraw", desc: "原生" },
                ]
            } else {
                return [
                    { value: "png" as const, label: "PNG", desc: "图片" },
                    { value: "svg" as const, label: "SVG", desc: "矢量" },
                    { value: "drawio" as const, label: "Draw.io", desc: "原生" },
                ]
            }
        }, [isExcalidraw])

        // 监听父元素大小变化，动态计算可用高度
        useEffect(() => {
            const updateMaxHeight = () => {
                if (!containerRef.current) return
                
                // 获取工具箱容器的父元素（输入框容器）
                const parent = containerRef.current.parentElement
                if (!parent) return
                
                // 获取父元素相对于视口的位置
                const parentRect = parent.getBoundingClientRect()
                
                // 顶部预留空间（标题栏高度 + 安全边距）
                const topReserved = 70
                
                // 可用高度 = 父元素顶部位置 - 顶部预留 - 工具箱与输入框的间距(10px)
                const available = parentRect.top - topReserved - 10
                
                setMaxAvailableHeight(Math.max(200, available)) // 最小 200px
            }
            
            updateMaxHeight()
            
            // 监听窗口大小变化
            window.addEventListener('resize', updateMaxHeight)
            
            // 使用 ResizeObserver 监听父元素大小变化（输入框高度变化）
            const parent = containerRef.current?.parentElement
            let resizeObserver: ResizeObserver | null = null
            if (parent) {
                resizeObserver = new ResizeObserver(updateMaxHeight)
                resizeObserver.observe(parent)
            }
            
            return () => {
                window.removeEventListener('resize', updateMaxHeight)
                resizeObserver?.disconnect()
            }
        }, [])

        // 计算实际高度：根据视图类型决定
        const computedStyle = useMemo(() => {
            const maxH = maxAvailableHeight ? `${maxAvailableHeight}px` : 'calc(90vh - 80px)'
            
            if (currentView === "export" || currentView === "url") {
                // 导出图表和URL提取视图：自适应高度
                return {
                    height: "auto",
                    maxHeight: maxH,
                }
            } else if (currentView === "config") {
                // 配置视图：固定高度，但不超过可用空间
                return {
                    height: "500px",
                    maxHeight: maxH,
                }
            } else {
                // 主视图：使用手动调整的高度，但不超过可用空间
                return {
                    height: `${Math.min(height, maxAvailableHeight || height)}px`,
                    maxHeight: maxH,
                }
            }
        }, [currentView, height, maxAvailableHeight])

        return (
            <>
            <div
                ref={containerRef}
                className="absolute left-3 right-3 bottom-[calc(100%+10px)] rounded-2xl bg-muted shadow-xl z-10 flex flex-col"
                style={computedStyle}
                onKeyDown={handleToolboxKeyDown}
            >
                {/* 拖拽调整高度的把手 - 仅在主视图显示 */}
                {currentView === "main" && (
                    <div
                        className="absolute top-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center hover:bg-background/50 transition-colors rounded-t-2xl z-10"
                        onMouseDown={handleDragStart}
                    >
                        <GripHorizontal className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                )}

                {/* 顶部栏 */}
                <div className={currentView === "main" ? "pt-3" : ""}>
                    {currentView === "main" && (
                        <ToolboxHeader
                            searchQuery={searchQuery}
                            onSearchChange={onSearchChange}
                            onKeyDown={handleToolboxKeyDown}
                            focusArea={focusArea}
                            onFocusChange={onFocusChange}
                            visibleToolbarButtons={visibleToolbarButtons}
                            toolbarActions={toolbarActions}
                            toolbarButtonRefs={toolbarButtonRefs}
                            matchedToolbarIndices={matchedToolbarIndices}
                            tooltipPosition={tooltipPosition}
                            setTooltipPosition={setTooltipPosition}
                            selectedModelName={selectedModelName}
                            searchInputRef={searchInputRef}
                            containerRef={containerRef}
                        />
                    )}
                    {currentView === "export" && renderExportHeader()}
                    {currentView === "url" && renderUrlHeader()}
                    {currentView === "config" && (
                        <SubviewHeader onBack={handleBack}>
                            <SearchInput
                                value={searchQuery || ""}
                                onChange={onSearchChange}
                                placeholder="搜索 Provider 或模型..."
                            />
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={showUnvalidatedModels}
                                    onCheckedChange={modelConfig.setShowUnvalidatedModels}
                                    className="scale-90"
                                />
                                <Label className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                                    显示未验证
                                </Label>
                            </div>
                        </SubviewHeader>
                    )}
                </div>

                {/* 内容区域 */}
                <div className="px-2 pb-2 overflow-y-auto flex-1">
                    {/* 主视图内容 */}
                    {currentView === "main" && (
                        <>
                            {/* COMMANDS */}
                            {filteredCommands.length > 0 && (
                                <div className="mb-1">
                                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 px-3 py-1 select-none">
                                        Commands
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        {filteredCommands.map((cmd, idx) => {
                                            const isFocused = focusArea.type === 'list' && focusArea.section === 'commands' && focusArea.index === idx
                                            return (
                                                <button
                                                    key={cmd.id}
                                                    type="button"
                                                    onClick={() => onSelectableItemClick(cmd)}
                                                    disabled={!cmd.enabled}
                                                    data-selected={isFocused ? "true" : undefined}
                                                    className={cn(
                                                        "w-full px-3 py-2 text-left transition-colors flex items-center gap-3 rounded-lg relative",
                                                        cmd.enabled
                                                            ? "text-foreground hover:bg-background/60"
                                                            : "text-muted-foreground cursor-not-allowed opacity-50",
                                                        // 键盘导航聚焦高亮
                                                        isFocused && "bg-background/80 ring-2 ring-primary/50"
                                                    )}
                                                >
                                                    <code className="text-sm font-mono text-primary">
                                                        {cmd.label}
                                                    </code>
                                                    <span className="text-xs text-muted-foreground truncate flex-1">
                                                        {cmd.desc}
                                                    </span>
                                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-background/80 text-muted-foreground whitespace-nowrap">
                                                        {cmd.badge}
                                                    </span>
                                                    {/* Enter 徽章 */}
                                                    {isFocused && (
                                                        <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground ml-1">
                                                            <CornerDownLeft className="h-2.5 w-2.5" />
                                                            Enter
                                                        </span>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* SKILLS */}
                            {filteredSkills.length > 0 && (
                                <div className="mb-1">
                                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 px-3 py-1 select-none">
                                        Skills
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        {filteredSkills.map((skill, idx) => {
                                            const isFocused = focusArea.type === 'list' && focusArea.section === 'skills' && focusArea.index === idx
                                            return (
                                                <button
                                                    key={skill.id}
                                                    type="button"
                                                    onClick={() => onSelectableItemClick(skill)}
                                                    data-selected={isFocused ? "true" : undefined}
                                                    className={cn(
                                                        "w-full px-3 py-2 text-left transition-colors flex items-center gap-3 rounded-lg relative",
                                                        skill.isCurrent
                                                            ? "bg-background/60 text-foreground"
                                                            : "text-foreground hover:bg-background/60",
                                                        // 键盘导航聚焦高亮
                                                        isFocused && "bg-background/80 ring-2 ring-primary/50"
                                                    )}
                                                >
                                                    <span className="text-sm">{skill.label}</span>
                                                    <span className="text-xs text-muted-foreground truncate flex-1">
                                                        {skill.desc}
                                                    </span>
                                                    {skill.isCurrent && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary/20 text-primary">
                                                            当前
                                                        </span>
                                                    )}
                                                    {/* Enter 徽章 */}
                                                    {isFocused && (
                                                        <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground ml-1">
                                                            <CornerDownLeft className="h-2.5 w-2.5" />
                                                            Enter
                                                        </span>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* HISTORY VERSIONS - 仅在按钮模式且无搜索时显示 */}
                            {!searchQuery && toolboxOpenMode === 'button' && (
                                <div className="mb-1">
                                    <div className="flex items-center justify-between px-3 py-1 select-none">
                                        {/* 标题区域 - 可点击切换布局 */}
                                        <button
                                            type="button"
                                            onClick={toggleHistoryLayout}
                                            className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors"
                                        >
                                            {historyLayout === "grid" ? (
                                                <ChevronUp className="h-3 w-3" />
                                            ) : (
                                                <ChevronDown className="h-3 w-3" />
                                            )}
                                            <span>History Versions</span>
                                        </button>
                                        <div className="flex items-center gap-1">
                                            <ButtonWithTooltip
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setVersionZoomLevel(Math.max(0, versionZoomLevel - 1))}
                                                disabled={versionZoomLevel === 0}
                                                tooltipContent="缩小"
                                                className="h-5 w-5 p-0"
                                            >
                                                <Minus className="h-3 w-3 text-muted-foreground" />
                                            </ButtonWithTooltip>
                                            <input
                                                type="range"
                                                min={0}
                                                max={ZOOM_LEVELS.length - 1}
                                                value={versionZoomLevel}
                                                onChange={(e) => setVersionZoomLevel(Number(e.target.value))}
                                                className="w-12 h-1 accent-primary cursor-pointer"
                                                title="调整大小"
                                            />
                                            <ButtonWithTooltip
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setVersionZoomLevel(Math.min(ZOOM_LEVELS.length - 1, versionZoomLevel + 1))}
                                                disabled={versionZoomLevel === ZOOM_LEVELS.length - 1}
                                                tooltipContent="放大"
                                                className="h-5 w-5 p-0"
                                            >
                                                <Plus className="h-3 w-3 text-muted-foreground" />
                                            </ButtonWithTooltip>
                                        </div>
                                    </div>
                                    {/* 历史版本列表 - 统一使用 grid，scroll 模式一行显示所有项目 */}
                                    <div 
                                        className={cn(
                                            "grid gap-2 py-1 px-2",
                                            historyLayout === "scroll" && "overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
                                        )}
                                        style={{ 
                                            // grid 模式：使用 auto-fill 让列宽固定；scroll 模式：一行显示所有
                                            gridTemplateColumns: historyLayout === "grid" 
                                                ? `repeat(auto-fill, minmax(calc((100% - ${(ZOOM_LEVELS[versionZoomLevel] - 1) * 8}px) / ${ZOOM_LEVELS[versionZoomLevel]}), 1fr))`
                                                : `repeat(${historyItems.length + 1}, calc(${100 / ZOOM_LEVELS[versionZoomLevel]}% - ${8 * (ZOOM_LEVELS[versionZoomLevel] - 1) / ZOOM_LEVELS[versionZoomLevel]}px))`,
                                        }}
                                    >
                                        {/* + 保存按钮在最前面 */}
                                        <div
                                            onClick={handleSaveVersion}
                                            className="relative group cursor-pointer rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary flex items-center justify-center hover:bg-primary/5 transition-all"
                                            style={{ aspectRatio: '1 / 1' }}
                                            title="保存当前版本"
                                        >
                                            <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </div>
                                        {/* 历史版本：最新在前（反转数组，但保持原始索引用于操作） */}
                                        {[...historyItems].reverse().map((item, displayIdx) => {
                                            // 计算原始索引：反转后的 displayIdx=0 对应原始的 length-1
                                            const originalIdx = historyItems.length - 1 - displayIdx
                                            return renderVersionThumbnail(item, originalIdx)
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* HISTORY SESSIONS - 在按钮模式或搜索匹配时显示 */}
                            {((toolboxOpenMode === 'button' && !searchQuery) || filteredSessions.length > 0) && sessions.length > 0 && (
                                <div className="mb-1">
                                    <div className="flex items-center justify-between px-3 py-1 select-none">
                                        {/* 标题区域 - 可点击切换布局 */}
                                        <button
                                            type="button"
                                            onClick={toggleSessionLayout}
                                            className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors"
                                        >
                                            {sessionLayout === "grid" ? (
                                                <ChevronUp className="h-3 w-3" />
                                            ) : (
                                                <ChevronDown className="h-3 w-3" />
                                            )}
                                            <span>History Sessions</span>
                                        </button>
                                        <div className="flex items-center gap-1">
                                            <ButtonWithTooltip
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setSessionZoomLevel(Math.max(0, sessionZoomLevel - 1))}
                                                disabled={sessionZoomLevel === 0}
                                                tooltipContent="缩小"
                                                className="h-5 w-5 p-0"
                                            >
                                                <Minus className="h-3 w-3 text-muted-foreground" />
                                            </ButtonWithTooltip>
                                            <input
                                                type="range"
                                                min={0}
                                                max={ZOOM_LEVELS.length - 1}
                                                value={sessionZoomLevel}
                                                onChange={(e) => setSessionZoomLevel(Number(e.target.value))}
                                                className="w-12 h-1 accent-primary cursor-pointer"
                                                title="调整大小"
                                            />
                                            <ButtonWithTooltip
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setSessionZoomLevel(Math.min(ZOOM_LEVELS.length - 1, sessionZoomLevel + 1))}
                                                disabled={sessionZoomLevel === ZOOM_LEVELS.length - 1}
                                                tooltipContent="放大"
                                                className="h-5 w-5 p-0"
                                            >
                                                <Plus className="h-3 w-3 text-muted-foreground" />
                                            </ButtonWithTooltip>
                                        </div>
                                    </div>
                                    {/* 会话列表 - 统一使用 grid，scroll 模式一行显示所有项目 */}
                                    <div 
                                        className={cn(
                                            "grid gap-2 py-1 px-2",
                                            sessionLayout === "scroll" && "overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
                                        )}
                                        style={{ 
                                            // grid 模式：使用 auto-fill 让列宽固定；scroll 模式：一行显示所有
                                            gridTemplateColumns: sessionLayout === "grid" 
                                                ? `repeat(auto-fill, minmax(calc((100% - ${(ZOOM_LEVELS[sessionZoomLevel] - 1) * 8}px) / ${ZOOM_LEVELS[sessionZoomLevel]}), 1fr))`
                                                : `repeat(${filteredSessions.length + 1}, calc(${100 / ZOOM_LEVELS[sessionZoomLevel]}% - ${8 * (ZOOM_LEVELS[sessionZoomLevel] - 1) / ZOOM_LEVELS[sessionZoomLevel]}px))`
                                        }}
                                    >
                                        {/* + 新建会话按钮 */}
                                        <div
                                            onClick={handleCreateSession}
                                            className="relative group cursor-pointer rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary flex items-center justify-center hover:bg-primary/5 transition-all"
                                            style={{ aspectRatio: '1 / 1' }}
                                            title="新建会话"
                                        >
                                            <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </div>
                                        {/* 会话列表：最新在前 */}
                                        {filteredSessions.map((session) =>
                                            renderSessionThumbnail(session)
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* MODELS */}
                            {filteredModels.length > 0 && (
                                <div>
                                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 px-3 py-1 select-none">
                                        Models
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        {filteredModels.map((model, idx) => {
                                            const isFocused = focusArea.type === 'list' && focusArea.section === 'models' && focusArea.index === idx
                                            return (
                                                <button
                                                    key={model.id}
                                                    type="button"
                                                    onClick={() => onSelectableItemClick(model)}
                                                    data-selected={isFocused ? "true" : undefined}
                                                    className={cn(
                                                        "w-full px-3 py-2 text-left transition-colors flex items-center gap-3 rounded-lg hover:bg-background/60 relative",
                                                        selectedModelId === model.id && "bg-background/60",
                                                        // 键盘导航聚焦高亮
                                                        isFocused && "bg-background/80 ring-2 ring-primary/50"
                                                    )}
                                                >
                                                    <img
                                                        alt={model.provider}
                                                        className="h-4 w-4 dark:invert shrink-0"
                                                        src={`https://models.dev/logos/${
                                                            PROVIDER_LOGO_MAP[model.provider] || model.provider
                                                        }.svg`}
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = "none"
                                                        }}
                                                    />

                                                    <span className="text-sm flex-1 truncate">
                                                        {model.providerLabel} / {model.modelId}
                                                    </span>

                                                    {model.validated !== true && (
                                                        <AlertTriangle className="h-3 w-3 text-warning shrink-0" />
                                                    )}

                                                    <Check
                                                        className={cn(
                                                            "h-4 w-4 shrink-0 text-primary",
                                                            selectedModelId === model.id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {/* Enter 徽章 */}
                                                    {isFocused && (
                                                        <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground ml-1">
                                                            <CornerDownLeft className="h-2.5 w-2.5" />
                                                            Enter
                                                        </span>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* 导出图表视图内容 */}
                    {currentView === "export" && (
                        <div className="space-y-3">
                            <div className="text-sm text-muted-foreground">
                                选择格式
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {saveFormats.map((fmt) => (
                                    <label
                                        key={fmt.value}
                                        className={cn(
                                            "inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition",
                                            saveFormat === fmt.value
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:bg-muted/50"
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name="format"
                                            value={fmt.value}
                                            checked={saveFormat === fmt.value}
                                            onChange={() => setSaveFormat(fmt.value)}
                                            className="accent-primary"
                                        />
                                        <span className="text-sm font-medium">{fmt.label}</span>
                                        <span className="text-xs text-muted-foreground">{fmt.desc}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* URL 提取视图内容 */}
                    {currentView === "url" && (
                        <div className="space-y-4 py-2">
                            <div className="text-sm text-muted-foreground">
                                输入 URL 地址，将自动提取页面内容作为上下文
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1">
                                <div>支持的内容类型：</div>
                                <ul className="list-disc list-inside pl-2">
                                    <li>网页文章</li>
                                    <li>GitHub README</li>
                                    <li>文档页面</li>
                                </ul>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                提示：提取的内容将作为图表生成的参考上下文
                            </div>
                        </div>
                    )}

                    {/* 模型配置视图内容 */}
                    {currentView === "config" && (
                        <ToolboxConfigView
                            searchQuery={searchQuery}
                            modelConfig={modelConfig}
                            showUnvalidatedModels={showUnvalidatedModels}
                            selectedProviderId={selectedProviderId}
                            setSelectedProviderId={setSelectedProviderId}
                            showApiKey={showApiKey}
                            setShowApiKey={setShowApiKey}
                            validationStatus={validationStatus}
                            setValidationStatus={setValidationStatus}
                            validationError={validationError}
                            setValidationError={setValidationError}
                            customModelInput={customModelInput}
                            setCustomModelInput={setCustomModelInput}
                            duplicateError={duplicateError}
                            setDuplicateError={setDuplicateError}
                            validatingModelIndex={validatingModelIndex}
                            setValidatingModelIndex={setValidatingModelIndex}
                            providerDeleteConfirm={providerDeleteConfirm}
                            setProviderDeleteConfirm={setProviderDeleteConfirm}
                            validationResetTimeoutRef={validationResetTimeoutRef}
                            onBack={handleBack}
                        />
                    )}
                </div>
            </div>

            {/* 确认恢复对话框 */}
            <RestoreConfirmDialog
                isOpen={restoreConfirmDialog.isOpen}
                onClose={handleCancelRestore}
                onDirectRestore={handleDirectRestore}
                onSaveAndRestore={handleSaveAndRestore}
                onInsertAndSelect={isExcalidraw ? handleInsertAndSelect : undefined}
                onDelete={handleRestoreDialogDelete}
                portalTarget={containerRef.current}
            />
            {/* 删除确认对话框 */}
            <DeleteConfirmDialog
                isOpen={deleteConfirmDialog.isOpen}
                onClose={handleCancelDelete}
                onConfirm={handleConfirmDelete}
                portalTarget={containerRef.current}
            />
            {/* 会话详情弹框 */}
            <SessionDetailDialog
                isOpen={sessionDetailDialog.isOpen}
                session={sessionDetailDialog.session}
                isCurrentSession={sessionDetailDialog.session?.id === currentSessionIdProp}
                onClose={handleCloseSessionDetail}
                onSwitch={handleSessionDetailSwitch}
                onDelete={handleSessionDetailDelete}
                onRename={handleSessionDetailRename}
                portalTarget={containerRef.current}
            />
        </>
        )
    }
)
