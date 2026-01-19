/**
 * 工具系统
 * 导出通用工具供 diagram-engines 使用
 */

export { BaseTool, ToolRegistry, toolRegistry, type ToolDefinition, type ToolResult } from "./base"
export { ReadTool, readTool, WriteTool, writeTool } from "./file"
export { SwitchCanvasTool, switchCanvasTool } from "./switch-canvas"
export { BashTool, bashTool } from "./bash"
