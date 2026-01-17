import { useMemo } from "react"
import type { Command, Skill, ModelItem, ToolboxSelectableItem } from "@/components/toolbox/main"
import {
    parseFilterTerms,
    filterItems,
    filterToolbarButtons,
    COMMAND_KEYWORDS,
    SKILL_KEYWORDS,
    MODEL_KEYWORDS,
    SESSION_KEYWORDS,
    TOOLBAR_BUTTON_KEYWORDS,
    type ToolbarButtonKeywords,
} from "@/shared/toolbox-keywords"

export interface Session {
    id: string
    title: string
    updatedAt: number
    thumbnailDataUrl?: string
    engineId?: string
}

// 模型的最小必要字段（用于过滤）
export interface FilterableModel {
    id: string
    modelId: string
    provider: string
    providerLabel: string
    validated?: boolean
}

export interface UseToolboxFilterOptions {
    // 输入源
    input: string
    toolboxSearchQuery: string
    // 工具箱状态
    isToolboxOpen: boolean
    toolboxOpenMode: 'button' | 'slash'
    // 原始数据
    commands: Command[]
    skills: Skill[]
    models: FilterableModel[]
    sessions: Session[]
    // 配置
    showUnvalidatedModels: boolean
}

export interface UseToolboxFilterReturn {
    // 计算出的过滤查询（去掉 / 前缀）
    filterQuery: string
    // 解析后的过滤词数组
    filterTerms: string[]
    // 是否处于斜杠命令模式
    isSlashMode: boolean
    // 过滤后的结果
    filteredCommands: Command[]
    filteredSkills: Skill[]
    filteredModels: ModelItem[]
    filteredSessions: Session[]
    // 匹配的工具栏按钮索引
    matchedToolbarIndices: number[]
    // 统一的可选项列表
    selectableItems: ToolboxSelectableItem[]
}

/**
 * 统一的工具箱过滤 Hook
 * 
 * 支持多级关键词过滤：
 * - 输入的文本使用空格切割，每个词进行逐级过滤
 * - 例如 "/model glm" 会先匹配 "model" 类型关键词（过滤出所有模型），
 *   然后用 "glm" 进一步过滤模型名称
 * 
 * 处理两种模式：
 * 1. 斜杠模式（slash）：用户在输入框输入 / 开头的内容触发
 *    - 过滤查询来自 input（去掉 / 前缀）
 *    - 主要用于快速命令匹配
 * 2. 按钮模式（button）：用户点击按钮打开工具箱
 *    - 过滤查询来自工具箱搜索框 toolboxSearchQuery
 *    - 用于搜索所有内容
 */
export function useToolboxFilter(options: UseToolboxFilterOptions): UseToolboxFilterReturn {
    const {
        input,
        toolboxSearchQuery,
        isToolboxOpen,
        toolboxOpenMode,
        commands,
        skills,
        models,
        sessions,
        showUnvalidatedModels,
    } = options

    // 判断是否处于斜杠命令模式
    const isSlashMode = useMemo(() => {
        return (
            (input.startsWith("/") && isToolboxOpen && toolboxOpenMode === 'slash') ||
            (toolboxSearchQuery.startsWith("/") && isToolboxOpen)
        )
    }, [input, toolboxSearchQuery, isToolboxOpen, toolboxOpenMode])

    // 计算实际的过滤查询
    // - 斜杠模式：使用 input 去掉 / 前缀后的内容
    // - 普通模式：使用 toolboxSearchQuery
    const filterQuery = useMemo(() => {
        if (isToolboxOpen && toolboxOpenMode === 'slash' && input.startsWith("/")) {
            // 斜杠模式：去掉 / 前缀
            return input.slice(1)
        }
        // 普通搜索模式：如果搜索框内容以 / 开头，也去掉前缀
        if (toolboxSearchQuery.startsWith("/")) {
            return toolboxSearchQuery.slice(1)
        }
        return toolboxSearchQuery
    }, [isToolboxOpen, toolboxOpenMode, input, toolboxSearchQuery])

    // 解析过滤词数组
    const filterTerms = useMemo(() => {
        return parseFilterTerms(filterQuery)
    }, [filterQuery])

    // 过滤 Commands - 使用新的关键词系统
    const filteredCommands = useMemo(() => {
        return filterItems(commands, COMMAND_KEYWORDS, filterTerms)
    }, [commands, filterTerms])

    // 过滤 Skills - 使用新的关键词系统
    const filteredSkills = useMemo(() => {
        return filterItems(skills, SKILL_KEYWORDS, filterTerms)
    }, [skills, filterTerms])

    // 过滤 Models - 使用新的关键词系统
    const filteredModels: ModelItem[] = useMemo(() => {
        let list = showUnvalidatedModels
            ? models
            : models.filter((m) => m.validated === true)

        // 使用关键词系统过滤
        list = filterItems(list, MODEL_KEYWORDS, filterTerms)

        return list.map((m) => ({
            id: m.id,
            type: "model" as const,
            modelId: m.modelId,
            provider: m.provider,
            providerLabel: m.providerLabel,
            validated: m.validated,
        }))
    }, [models, filterTerms, showUnvalidatedModels])

    // 过滤 Sessions（历史会话）- 使用新的关键词系统
    const filteredSessions = useMemo(() => {
        return filterItems(sessions, SESSION_KEYWORDS, filterTerms)
    }, [sessions, filterTerms])

    // 匹配的工具栏按钮索引
    const matchedToolbarIndices = useMemo(() => {
        return filterToolbarButtons(TOOLBAR_BUTTON_KEYWORDS, filterTerms)
    }, [filterTerms])

    // 统一的可选项列表
    const selectableItems: ToolboxSelectableItem[] = useMemo(() => {
        return [
            ...filteredCommands,
            ...filteredSkills,
            ...filteredModels,
        ]
    }, [filteredCommands, filteredSkills, filteredModels])

    return {
        filterQuery,
        filterTerms,
        isSlashMode,
        filteredCommands,
        filteredSkills,
        filteredModels,
        filteredSessions,
        matchedToolbarIndices,
        selectableItems,
    }
}
