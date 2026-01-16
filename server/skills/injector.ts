import type { Skill } from './loader'

/**
 * 将激活的 Skills 注入到 System Prompt
 */
export function injectSkills(
  basePrompt: string,
  activeSkills: Skill[]
): string {
  if (activeSkills.length === 0) return basePrompt

  const skillSections = activeSkills.map(skill => {
    let section = `## Skill: ${skill.frontmatter.name}\n\n${skill.content}`

    // 附加资源文件
    for (const [filename, content] of Object.entries(skill.resources)) {
      section += `\n\n### ${filename}\n\n${content}`
    }

    return section
  }).join('\n\n---\n\n')

  return `${basePrompt}

---

# Active Skills

The following skills have been loaded to assist with this task:

${skillSections}
`
}

/**
 * 生成 Skill 引导信息（当用户只输入 /skill 时显示）
 */
export function generateSkillGuide(skill: Skill): string {
  const { frontmatter, content } = skill

  // 从 content 中提取示例（查找 Examples 或 示例 部分）
  const examplesMatch = content.match(/##\s*(Examples|示例)[^\n]*\n([\s\S]*?)(?=\n##|$)/i)
  let examples = ''
  if (examplesMatch) {
    examples = examplesMatch[2]
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .slice(0, 4)
      .map(line => line.trim())
      .join('\n')
  }

  // 从 content 中提取可用形状/服务概览
  const overviewMatch = content.match(/##\s*(Overview|概述)[^\n]*\n([\s\S]*?)(?=\n##|$)/i)
  const overview = overviewMatch ? overviewMatch[2].trim() : ''

  return `**${frontmatter.name.toUpperCase()} Skill 已激活**

${frontmatter.description}

${overview ? `\n${overview}\n` : ''}
${examples ? `\n**试试这些示例：**\n${examples}` : ''}
`
}
