/**
 * Skill 加载器（简化版）
 * 
 * 只负责加载引擎级别的 SKILL.md 文件
 * 其他文档（shape-libraries、dsl 等）由 LLM 通过 read_file 工具按需读取
 */

import matter from 'gray-matter'
import fs from 'fs'
import path from 'path'

export type EngineType = 'drawio' | 'excalidraw'

/**
 * Skill 元数据（frontmatter）
 */
export interface SkillFrontmatter {
    name: string
    description: string
    engine?: EngineType
}

/**
 * Skill 定义
 */
export interface Skill {
    id: string                      // 引擎 ID，如 'drawio', 'excalidraw'
    frontmatter: SkillFrontmatter
    content: string                 // SKILL.md 的完整内容（不含 frontmatter）
    path: string                    // SKILL.md 文件路径
}

/**
 * Skill 加载器
 */
export class SkillLoader {
    private skillsDir: string
    private cache: Map<string, Skill> = new Map()

    constructor(skillsDir: string) {
        this.skillsDir = skillsDir
    }

    /**
     * 加载指定引擎的 SKILL.md
     */
    loadEngineSkill(engineId: EngineType): Skill | null {
        if (this.cache.has(engineId)) {
            return this.cache.get(engineId)!
        }

        const skillFile = path.join(this.skillsDir, engineId, 'SKILL.md')

        try {
            if (!fs.existsSync(skillFile)) {
                console.warn(`[SkillLoader] Engine skill not found: ${skillFile}`)
                return null
            }

            const fileContent = fs.readFileSync(skillFile, 'utf-8')
            const { data, content } = matter(fileContent)

            const skill: Skill = {
                id: engineId,
                frontmatter: data as SkillFrontmatter,
                content: content.trim(),
                path: skillFile
            }

            this.cache.set(engineId, skill)
            return skill
        } catch (error) {
            console.error(`[SkillLoader] Failed to load engine skill "${engineId}":`, error)
            return null
        }
    }

    /**
     * 获取引擎 SKILL.md 的内容（用于注入 system prompt）
     */
    getEngineSkillContent(engineId: EngineType): string {
        const skill = this.loadEngineSkill(engineId)
        return skill?.content || ''
    }

    /**
     * 列出所有可用的引擎
     */
    listEngines(): EngineType[] {
        const engines: EngineType[] = []

        try {
            const dirs = fs.readdirSync(this.skillsDir, { withFileTypes: true })

            for (const dir of dirs) {
                if (dir.isDirectory() && !dir.name.startsWith('_')) {
                    const skillFile = path.join(this.skillsDir, dir.name, 'SKILL.md')
                    if (fs.existsSync(skillFile)) {
                        engines.push(dir.name as EngineType)
                    }
                }
            }
        } catch (error) {
            console.error('[SkillLoader] Failed to list engines:', error)
        }

        return engines
    }

    // ============ 向后兼容方法（已废弃）============

    /** @deprecated 使用 loadEngineSkill 代替 */
    loadSkill(skillId: string): Skill | null {
        return this.loadEngineSkill(skillId as EngineType)
    }

    /** @deprecated 不再需要 */
    listSkills(): Skill[] {
        return this.listEngines()
            .map(id => this.loadEngineSkill(id))
            .filter((s): s is Skill => s !== null)
    }

    /**
     * 清除缓存
     */
    clearCache(): void {
        this.cache.clear()
    }
}

// 单例实例
let loaderInstance: SkillLoader | null = null

/**
 * 获取 SkillLoader 单例
 */
export function getSkillLoader(skillsDir?: string): SkillLoader {
    if (!loaderInstance && skillsDir) {
        loaderInstance = new SkillLoader(skillsDir)
    }
    if (!loaderInstance) {
        throw new Error('SkillLoader not initialized. Please provide skillsDir.')
    }
    return loaderInstance
}

/**
 * 初始化 SkillLoader
 */
export function initSkillLoader(skillsDir: string): SkillLoader {
    loaderInstance = new SkillLoader(skillsDir)
    return loaderInstance
}

/** @deprecated 不再使用 */
export function filterSkillsByEngine(): Skill[] {
    console.warn('filterSkillsByEngine is deprecated')
    return []
}
