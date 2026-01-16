import matter from 'gray-matter'
import fs from 'fs'
import path from 'path'

export interface SkillFrontmatter {
  name: string
  description: string
  engine?: 'drawio' | 'excalidraw' | 'both'
  license?: string
}

export interface Skill {
  id: string
  frontmatter: SkillFrontmatter
  content: string
  resources: Record<string, string>
  path: string
}

export type EngineType = 'drawio' | 'excalidraw'

/**
 * 根据当前引擎过滤可用的 Skills
 */
export function filterSkillsByEngine(
  skills: Skill[],
  currentEngine: EngineType
): Skill[] {
  return skills.filter(skill => {
    const skillEngine = skill.frontmatter.engine

    // 没有指定引擎的 Skill 对所有引擎可用
    if (!skillEngine) return true

    // 明确指定 'both' 的对所有引擎可用
    if (skillEngine === 'both') return true

    // 否则必须匹配当前引擎
    return skillEngine === currentEngine
  })
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
   * 加载单个 Skill
   */
  loadSkill(skillId: string): Skill | null {
    if (this.cache.has(skillId)) {
      return this.cache.get(skillId)!
    }

    const skillPath = path.join(this.skillsDir, skillId)
    const skillFile = path.join(skillPath, 'SKILL.md')

    try {
      if (!fs.existsSync(skillFile)) {
        return null
      }

      const fileContent = fs.readFileSync(skillFile, 'utf-8')
      const { data, content } = matter(fileContent)

      const skill: Skill = {
        id: skillId,
        frontmatter: data as SkillFrontmatter,
        content: content.trim(),
        resources: this.loadResources(skillPath),
        path: skillPath
      }

      this.cache.set(skillId, skill)
      return skill
    } catch (error) {
      console.error(`[SkillLoader] Failed to load skill "${skillId}":`, error)
      return null
    }
  }

  /**
   * 加载 Skill 目录下的附加资源文件
   */
  private loadResources(skillPath: string): Record<string, string> {
    const resources: Record<string, string> = {}

    try {
      const files = fs.readdirSync(skillPath)

      for (const file of files) {
        if (file !== 'SKILL.md' && file.endsWith('.md')) {
          const filePath = path.join(skillPath, file)
          const content = fs.readFileSync(filePath, 'utf-8')
          resources[file] = content
        }
      }
    } catch (error) {
      console.error(`[SkillLoader] Failed to load resources from "${skillPath}":`, error)
    }

    return resources
  }

  /**
   * 列出所有可用的 Skills
   */
  listSkills(): Skill[] {
    const skills: Skill[] = []

    try {
      if (!fs.existsSync(this.skillsDir)) {
        return skills
      }

      const dirs = fs.readdirSync(this.skillsDir, { withFileTypes: true })

      for (const dir of dirs) {
        if (dir.isDirectory()) {
          const skill = this.loadSkill(dir.name)
          if (skill) {
            skills.push(skill)
          }
        }
      }
    } catch (error) {
      console.error('[SkillLoader] Failed to list skills:', error)
    }

    return skills
  }

  /**
   * 列出指定引擎可用的 Skills
   */
  listSkillsForEngine(engine: EngineType): Skill[] {
    const allSkills = this.listSkills()
    return filterSkillsByEngine(allSkills, engine)
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
