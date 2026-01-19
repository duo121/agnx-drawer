/**
 * Bash 执行工具
 * 执行 shell 命令并返回结果
 */

import { exec } from "child_process"
import { promisify } from "util"
import { z } from "zod"
import { BaseTool, type ToolResult } from "./base"

const execAsync = promisify(exec)

/**
 * Bash 工具输入
 */
const BashInputSchema = z.object({
    command: z.string().describe("The shell command to execute"),
    timeout: z
        .number()
        .optional()
        .default(30000)
        .describe("Timeout in milliseconds (default: 30000)"),
    cwd: z.string().optional().describe("Working directory for the command"),
})

type BashInput = z.infer<typeof BashInputSchema>

/**
 * Bash 工具结果
 */
interface BashResult extends ToolResult {
    stdout?: string
    stderr?: string
    exitCode?: number
    command?: string
}

/**
 * Bash 工具
 * 执行 shell 命令并返回输出
 */
export class BashTool extends BaseTool<BashInput, BashResult> {
    name = "bash"
    description = `Execute a shell command and return the output.

Usage:
- Execute any shell command on the server
- The command runs with a default timeout of 30 seconds
- You can specify a custom working directory
- Both stdout and stderr are captured and returned

Security notes:
- Commands are executed in a sandboxed environment
- Avoid running commands that require user interaction
- Long-running commands may timeout`

    getInputSchema() {
        return BashInputSchema
    }

    async execute(input: BashInput): Promise<BashResult> {
        const { command, timeout = 30000, cwd } = input

        // 基本安全检查
        const dangerousPatterns = [
            /rm\s+(-rf?|--recursive)\s+[\/~]/i, // rm -rf /
            /:\(\)\s*\{\s*:\|\s*:\s*&\s*\}\s*;/i, // fork bomb
            /mkfs\./i, // format filesystem
            /dd\s+if=.*of=\/dev/i, // overwrite devices
            />\s*\/dev\/sd[a-z]/i, // write to disk devices
        ]

        for (const pattern of dangerousPatterns) {
            if (pattern.test(command)) {
                return {
                    success: false,
                    error: "Command rejected: potentially dangerous operation detected",
                    command,
                }
            }
        }

        try {
            const options: { timeout: number; cwd?: string; maxBuffer: number } = {
                timeout,
                maxBuffer: 1024 * 1024 * 10, // 10MB buffer
            }

            if (cwd) {
                options.cwd = cwd
            }

            const { stdout, stderr } = await execAsync(command, options)

            return {
                success: true,
                output: stdout || stderr || "(no output)",
                stdout: stdout || "",
                stderr: stderr || "",
                exitCode: 0,
                command,
            }
        } catch (err: any) {
            // 命令执行失败但有输出
            if (err.stdout || err.stderr) {
                return {
                    success: false,
                    output: err.stderr || err.stdout || err.message,
                    stdout: err.stdout || "",
                    stderr: err.stderr || "",
                    exitCode: err.code || 1,
                    error: err.message,
                    command,
                }
            }

            // 完全失败
            const message = err instanceof Error ? err.message : String(err)
            return {
                success: false,
                error: message,
                command,
            }
        }
    }
}

/**
 * 创建 Bash 工具实例
 */
export const bashTool = new BashTool()
