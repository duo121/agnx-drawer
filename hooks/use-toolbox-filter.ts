import { useMemo } from "react"
import type { Command, Skill, ModelItem, ToolboxSelectableItem } from "@/components/toolbox/main"

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
    // 是否处于斜杠命令模式
    isSlashMode: boolean
    // 过滤后的结果
    filteredCommands: Command[]
    filteredSkills: Skill[]
    filteredModels: ModelItem[]
    filteredSessions: Session[]
    // 统一的可选项列表
    selectableItems: ToolboxSelectableItem[]
}

/**
 * 统一的工具箱过滤 Hook
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

    // 过滤 Commands
    const filteredCommands = useMemo(() => {
        return commands.filter((cmd) => {
            if (!filterQuery) return true
            const q = filterQuery.toLowerCase()
            if (isSlashMode) {
                // 斜杠模式：匹配 label（去掉 / 前缀后）
                return cmd.label.slice(1).toLowerCase().includes(q)
            } else {
                // 搜索框模式：匹配 id + label + desc
                return (
                    cmd.id.toLowerCase().includes(q) ||
                    cmd.label.toLowerCase().includes(q) ||
                    cmd.desc.toLowerCase().includes(q)
                )
            }
        })
    }, [commands, filterQuery, isSlashMode])

    // 过滤 Skills
    const filteredSkills = useMemo(() => {
        return skills.filter((skill) => {
            if (!filterQuery) return true
            const q = filterQuery.toLowerCase()
            if (isSlashMode) {
                // 斜杠模式：匹配 id 或 label
                return (
                    skill.id.toLowerCase().includes(q) ||
                    skill.label.toLowerCase().includes(q)
                )
            } else {
                // 搜索框模式：匹配 id + label + desc
                return (
                    skill.id.toLowerCase().includes(q) ||
                    skill.label.toLowerCase().includes(q) ||
                    skill.desc.toLowerCase().includes(q)
                )
            }
        })
    }, [skills, filterQuery, isSlashMode])

    // 过滤 Models
    const filteredModels: ModelItem[] = useMemo(() => {
        let list = showUnvalidatedModels
            ? models
            : models.filter((m) => m.validated === true)

        if (filterQuery) {
            const q = filterQuery.toLowerCase()
            list = list.filter(
                (m) =>
                    m.modelId.toLowerCase().includes(q) ||
                    m.provider.toLowerCase().includes(q) ||
                    m.providerLabel.toLowerCase().includes(q)
            )
        }

        return list.map((m) => ({
            id: m.id,
            type: "model" as const,
            modelId: m.modelId,
            provider: m.provider,
            providerLabel: m.providerLabel,
            validated: m.validated,
        }))
    }, [models, filterQuery, showUnvalidatedModels])

    // 过滤 Sessions（历史会话）
    const filteredSessions = useMemo(() => {
        if (!filterQuery) return sessions
        const q = filterQuery.toLowerCase()
        return sessions.filter((s) => s.title.toLowerCase().includes(q))
    }, [sessions, filterQuery])

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
        isSlashMode,
        filteredCommands,
        filteredSkills,
        filteredModels,
        filteredSessions,
        selectableItems,
    }
}
