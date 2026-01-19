/**
 * 工具箱统一关键词配置
 * 
 * 用于命令模式的多级过滤功能：
 * - 输入的文本使用空格切割，每个词进行逐级过滤
 * - 例如 "/model glm" 会先匹配 "model" 关键词（过滤出所有模型），
 *   然后用 "glm" 进一步过滤
 */

// ============ 类型定义 ============

export interface KeywordConfig {
    /** 类型关键词，用于快速筛选某一类别 */
    typeKeywords: string[]
    /** 获取某个具体项目的可搜索字段 */
    getSearchableFields: (item: any) => string[]
}

// ============ 关键词配置 ============

/**
 * 命令关键词配置
 * 触发关键词：command, cmd, 命令
 * 可搜索字段：命令 ID、命令名称（去掉 / 前缀）、命令描述
 */
export const COMMAND_KEYWORDS: KeywordConfig = {
    typeKeywords: ['command', 'cmd', '命令'],
    getSearchableFields: (cmd: { id: string; label: string; desc: string }) => [
        cmd.id,
        cmd.label.replace(/^\//, ''), // 去掉 / 前缀
        cmd.label, // 带 / 前缀的版本
        cmd.desc,
    ],
}

/**
 * 技能关键词配置
 * 触发关键词：skill, 技能, engine, 引擎
 * 可搜索字段：技能 ID、技能名称、技能描述
 */
export const SKILL_KEYWORDS: KeywordConfig = {
    typeKeywords: ['skill', '技能', 'engine', '引擎'],
    getSearchableFields: (skill: { id: string; label: string; desc: string }) => [
        skill.id,
        skill.label,
        skill.desc,
    ],
}

/**
 * 模型关键词配置
 * 触发关键词：model, 模型, provider, 提供商
 * 可搜索字段：模型 ID、提供商名称、提供商标签
 */
export const MODEL_KEYWORDS: KeywordConfig = {
    typeKeywords: ['model', '模型', 'provider', '提供商'],
    getSearchableFields: (model: { modelId: string; provider: string; providerLabel: string }) => [
        model.modelId,
        model.provider,
        model.providerLabel,
    ],
}

/**
 * 历史会话关键词配置
 * 触发关键词：session, 会话, history, 历史, chat, 聊天
 * 可搜索字段：会话标题
 */
export const SESSION_KEYWORDS: KeywordConfig = {
    typeKeywords: ['session', '会话', 'history', '历史', 'chat', '聊天'],
    getSearchableFields: (session: { title: string }) => [
        session.title,
    ],
}

/**
 * 工具栏按钮关键词配置
 * 每个按钮有独立的关键词
 */
export interface ToolbarButtonKeywords {
    key: string
    command: string
    keywords: string[]
    tooltip: string
}

export const TOOLBAR_BUTTON_KEYWORDS: ToolbarButtonKeywords[] = [
    {
        key: 'save',
        command: '/save',
        keywords: ['save', '保存', 'version', '版本'],
        tooltip: '/save 保存当前版本',
    },
    {
        key: 'export',
        command: '/export',
        keywords: ['export', '导出', 'download', '下载'],
        tooltip: '/export 导出图表',
    },
    {
        key: 'share',
        command: '/share',
        keywords: ['share', '分享', 'image', '图片', 'markdown', '长图'],
        tooltip: '/share 分享会话为图片或 Markdown',
    },
    {
        key: 'upload',
        command: '/upload',
        keywords: ['upload', '上传', 'image', '图片', 'file', '文件'],
        tooltip: '/upload 上传文件',
    },
    {
        key: 'url',
        command: '/url',
        keywords: ['url', '链接', 'link', 'extract', '提取', 'web', '网页'],
        tooltip: '/url 从 URL 提取',
    },
    {
        key: 'model',
        command: '/model',
        keywords: ['model', '模型', 'config', '配置', 'setting', '设置', 'provider', '提供商'],
        tooltip: '/model 配置模型',
    },
]

// ============ 过滤工具函数 ============

/**
 * 解析查询字符串，返回过滤词数组
 * @param query 查询字符串（可能以 / 开头）
 * @returns 过滤词数组（全部小写）
 */
export function parseFilterTerms(query: string): string[] {
    // 去掉开头的 /
    const trimmed = query.replace(/^\//, '').trim()
    if (!trimmed) return []
    
    // 按空格切割，过滤空字符串
    return trimmed.split(/\s+/).filter(Boolean).map(t => t.toLowerCase())
}

/**
 * 检查项目是否匹配所有过滤词
 * @param searchableFields 项目的可搜索字段
 * @param filterTerms 过滤词数组
 * @returns 是否匹配
 */
export function matchesAllTerms(searchableFields: string[], filterTerms: string[]): boolean {
    if (filterTerms.length === 0) return true
    
    const lowerFields = searchableFields.map(f => f.toLowerCase())
    
    // 每个过滤词都必须在至少一个字段中匹配
    return filterTerms.every(term => 
        lowerFields.some(field => field.includes(term))
    )
}

/**
 * 检查类型关键词是否匹配
 * @param typeKeywords 类型关键词数组
 * @param filterTerms 过滤词数组
 * @returns 是否有类型关键词匹配（以及剩余的过滤词）
 */
export function matchTypeKeyword(
    typeKeywords: string[],
    filterTerms: string[]
): { matched: boolean; remainingTerms: string[] } {
    if (filterTerms.length === 0) {
        return { matched: false, remainingTerms: [] }
    }
    
    const lowerTypeKeywords = typeKeywords.map(k => k.toLowerCase())
    
    // 检查第一个词是否是类型关键词
    const firstTerm = filterTerms[0]
    if (lowerTypeKeywords.some(k => k.includes(firstTerm) || firstTerm.includes(k))) {
        return { matched: true, remainingTerms: filterTerms.slice(1) }
    }
    
    return { matched: false, remainingTerms: filterTerms }
}

/**
 * 通用过滤函数
 * @param items 要过滤的项目数组
 * @param keywordConfig 关键词配置
 * @param filterTerms 过滤词数组
 * @returns 过滤后的项目数组
 */
export function filterItems<T>(
    items: T[],
    keywordConfig: KeywordConfig,
    filterTerms: string[]
): T[] {
    if (filterTerms.length === 0) return items
    
    // 检查是否有类型关键词匹配
    const { matched: typeMatched, remainingTerms } = matchTypeKeyword(
        keywordConfig.typeKeywords,
        filterTerms
    )
    
    if (typeMatched) {
        // 类型关键词匹配，使用剩余词过滤
        if (remainingTerms.length === 0) {
            // 只有类型关键词，返回所有项目
            return items
        }
        // 用剩余词在字段中过滤
        return items.filter(item => 
            matchesAllTerms(keywordConfig.getSearchableFields(item), remainingTerms)
        )
    }
    
    // 没有类型关键词匹配，直接用所有词在字段中过滤
    return items.filter(item => 
        matchesAllTerms(keywordConfig.getSearchableFields(item), filterTerms)
    )
}

/**
 * 过滤工具栏按钮
 * @param buttons 工具栏按钮配置数组
 * @param filterTerms 过滤词数组
 * @returns 匹配的按钮索引数组
 */
export function filterToolbarButtons(
    buttons: ToolbarButtonKeywords[],
    filterTerms: string[]
): number[] {
    if (filterTerms.length === 0) return []
    
    const matchedIndices: number[] = []
    
    buttons.forEach((btn, index) => {
        // 检查是否所有过滤词都匹配按钮的某个关键词或命令
        const allKeywords = [
            ...btn.keywords,
            btn.command.replace(/^\//, ''),
            btn.key,
        ].map(k => k.toLowerCase())
        
        const matches = filterTerms.every(term =>
            allKeywords.some(k => k.includes(term) || term.includes(k))
        )
        
        if (matches) {
            matchedIndices.push(index)
        }
    })
    
    return matchedIndices
}

/**
 * 判断某个类别是否应该显示（基于类型关键词）
 * @param typeKeywords 类型关键词数组
 * @param filterTerms 过滤词数组
 * @returns 是否应该显示该类别
 */
export function shouldShowCategory(
    typeKeywords: string[],
    filterTerms: string[]
): boolean {
    if (filterTerms.length === 0) return true
    
    const lowerTypeKeywords = typeKeywords.map(k => k.toLowerCase())
    const firstTerm = filterTerms[0]
    
    // 如果第一个词匹配类型关键词，显示该类别
    return lowerTypeKeywords.some(k => k.includes(firstTerm) || firstTerm.includes(k))
}
