import type { Skill, EngineType } from './loader'
import { filterSkillsByEngine } from './loader'

export interface MatchResult {
  skillId: string
  score: number
  reason: string
}

/**
 * Skill 语义匹配器
 * 根据用户输入自动匹配最相关的 Skills
 */
export class SkillMatcher {
  private skills: Skill[]

  constructor(skills: Skill[]) {
    this.skills = skills
  }

  /**
   * 基于用户输入语义匹配最相关的 Skills
   *
   * @param userInput 用户输入文本
   * @param currentEngine 当前引擎类型
   * @param threshold 最低匹配分数阈值（默认 2）
   * @returns 匹配结果数组，按分数降序排列
   */
  match(
    userInput: string,
    currentEngine: EngineType,
    threshold: number = 2
  ): MatchResult[] {
    const results: MatchResult[] = []
    const inputLower = userInput.toLowerCase()

    // 先过滤引擎
    const availableSkills = filterSkillsByEngine(this.skills, currentEngine)

    for (const skill of availableSkills) {
      const description = skill.frontmatter.description.toLowerCase()
      const content = skill.content.toLowerCase()
      let score = 0
      const reasons: string[] = []

      // 从 description 提取关键词
      const descKeywords = this.extractKeywords(description)
      for (const keyword of descKeywords) {
        if (inputLower.includes(keyword)) {
          score += 2 // description 匹配权重更高
          reasons.push(keyword)
        }
      }

      // 从 content 提取关键词（权重较低）
      const contentKeywords = this.extractKeywords(content)
      for (const keyword of contentKeywords) {
        if (inputLower.includes(keyword) && !reasons.includes(keyword)) {
          score += 1
          reasons.push(keyword)
        }
      }

      // 检查 skill name 直接匹配
      if (inputLower.includes(skill.frontmatter.name.toLowerCase())) {
        score += 5
        reasons.unshift(skill.frontmatter.name)
      }

      if (score >= threshold) {
        results.push({
          skillId: skill.id,
          score,
          reason: `Matched: ${reasons.slice(0, 5).join(', ')}`
        })
      }
    }

    return results.sort((a, b) => b.score - a.score)
  }

  /**
   * 获取最佳匹配的 Skill（如果有）
   */
  getBestMatch(
    userInput: string,
    currentEngine: EngineType,
    threshold: number = 3
  ): MatchResult | null {
    const matches = this.match(userInput, currentEngine, threshold)
    return matches.length > 0 ? matches[0] : null
  }

  /**
   * 从文本中提取关键词
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'for', 'to', 'of', 'and', 'or',
      'when', 'use', 'this', 'skill', 'with', 'in', 'on', 'at', 'by',
      'that', 'it', 'as', 'be', 'can', 'will', 'from', 'have', 'has',
      'any', 'all', 'your', 'you', 'like', 'such', 'etc', 'using',
      '的', '是', '在', '和', '或', '用', '使用', '可以', '进行',
      '一个', '这个', '那个', '什么', '怎么', '如何', '请', '帮我',
      '画', '绘制', '创建', '生成', '做', '设计'
    ])

    // 提取有意义的关键词（长度 > 2，非停用词）
    const words = text
      .split(/[\s,.:;!?()[\]{}'"<>\/\\|`~@#$%^&*+=]+/)
      .filter(word => {
        const w = word.toLowerCase()
        return w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w)
      })

    // 去重
    return [...new Set(words)]
  }
}

/**
 * 快速匹配函数（无需实例化）
 */
export function matchSkills(
  skills: Skill[],
  userInput: string,
  currentEngine: EngineType,
  threshold: number = 2
): MatchResult[] {
  const matcher = new SkillMatcher(skills)
  return matcher.match(userInput, currentEngine, threshold)
}

/**
 * 获取最佳匹配（无需实例化）
 */
export function getBestSkillMatch(
  skills: Skill[],
  userInput: string,
  currentEngine: EngineType,
  threshold: number = 3
): MatchResult | null {
  const matcher = new SkillMatcher(skills)
  return matcher.getBestMatch(userInput, currentEngine, threshold)
}
