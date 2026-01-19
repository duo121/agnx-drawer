/**
 * Skill 系统
 * 
 * 简化后的架构：
 * - loader: 只加载引擎级别的 SKILL.md
 * - intent-parser: 解析用户意图（用于画布切换判断）
 * 
 * 其他文档（shape-libraries、dsl 等）由 LLM 通过 read_file 工具按需读取
 */

export {
    SkillLoader,
    getSkillLoader,
    initSkillLoader,
    type Skill,
    type SkillFrontmatter,
    type EngineType
} from './loader'

export {
    parseUserIntent,
    needsCanvasSwitch,
    formatIntent,
    type UserIntent,
    type CanvasType,
    type DSLType
} from './intent-parser'

// 向后兼容导出（已废弃）
export { filterSkillsByEngine } from './loader'
