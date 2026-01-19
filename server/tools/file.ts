/**
 * 文件操作工具
 * Read - 通用文件读取
 */

import * as fs from "fs"
import * as path from "path"
import { z } from "zod"
import { BaseTool, type ToolResult } from "./base"

/**
 * Read 工具输入
 */
const ReadInputSchema = z.object({
    file_path: z.string().describe("The path to the file to read (absolute or relative to cwd)"),
    offset: z.number().optional().describe("The line number to start reading from (0-indexed)"),
    limit: z.number().optional().describe("The number of lines to read"),
})

type ReadInput = z.infer<typeof ReadInputSchema>

/**
 * Read 工具结果
 */
interface ReadResult extends ToolResult {
    lineCount?: number
}

/**
 * Read 工具
 * 通用文件读取，支持任意路径
 */
export class ReadTool extends BaseTool<ReadInput, ReadResult> {
    name = "read_file"
    description = `Read a file from the filesystem.

Usage:
- The file_path can be absolute or relative to the current working directory
- By default, reads up to 2000 lines starting from the beginning
- You can specify offset and limit for partial reads
- Results are returned with line numbers (1-indexed)
- Lines longer than 2000 characters will be truncated

Use this tool to read skill documentation, configuration files, or any text file.
For skill documentation, common paths include:
- skills/drawio/SKILL.md - Draw.io engine reference
- skills/drawio/shape-libraries/aws4.md - AWS icons documentation
- skills/excalidraw/SKILL.md - Excalidraw engine reference`

    getInputSchema() {
        return ReadInputSchema
    }

    async execute(input: ReadInput): Promise<ReadResult> {
        const { file_path, offset = 0, limit = 2000 } = input

        try {
            // 解析路径（支持相对路径）
            const resolvedPath = path.isAbsolute(file_path)
                ? file_path
                : path.resolve(process.cwd(), file_path)

            // 检查文件是否存在
            if (!fs.existsSync(resolvedPath)) {
                return this.error(`File not found: ${file_path}`) as ReadResult
            }

            // 检查是否是目录
            const stat = fs.statSync(resolvedPath)
            if (stat.isDirectory()) {
                return this.error(
                    `Path is a directory: ${file_path}. Use ls command to list directory contents.`
                ) as ReadResult
            }

            // 读取文件
            const content = fs.readFileSync(resolvedPath, "utf-8")
            const lines = content.split("\n")
            const totalLines = lines.length

            // 选择行范围
            const selectedLines = lines.slice(offset, offset + limit)

            // 格式化带行号的输出
            const maxLineNumWidth = String(offset + selectedLines.length).length
            const output = selectedLines
                .map((line, idx) => {
                    const lineNum = String(offset + idx + 1).padStart(maxLineNumWidth, " ")
                    // 截断过长的行
                    const truncatedLine =
                        line.length > 2000 ? line.substring(0, 2000) + "..." : line
                    return `${lineNum}|${truncatedLine}`
                })
                .join("\n")

            // 添加截断提示
            let finalOutput = output
            if (offset + limit < totalLines) {
                finalOutput += `\n\n[... ${totalLines - offset - limit} more lines. Use offset=${offset + limit} to continue reading.]`
            }

            return {
                success: true,
                output: finalOutput,
                content: content,
                lineCount: totalLines,
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return this.error(`Error reading file: ${message}`) as ReadResult
        }
    }
}

/**
 * 创建 Read 工具实例
 */
export const readTool = new ReadTool()
