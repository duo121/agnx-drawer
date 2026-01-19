/**
 * 工具系统
 * 导出通用工具供 diagram-engines 使用
 */

export { BaseTool, ToolRegistry, toolRegistry, type ToolDefinition, type ToolResult } from "./base"
export { ReadTool, readTool } from "./file"
export { SwitchCanvasTool, switchCanvasTool } from "./switch-canvas"
