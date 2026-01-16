/**
 * 引擎模块入口
 *
 * 提供：
 * - 类型定义导出
 * - 服务工厂导出
 * - 引擎注册表
 * - React Hooks
 */

// ============ 类型导出 ============

export type {
    EngineId,
    HistoryEntry,
    ExportFormat,
    EngineService,
    EngineServiceDeps,
    DrawioServiceDeps,
    ExcalidrawServiceDeps,
    EngineServiceFactory,
    EngineRegistryEntry,
} from "./types"

// ============ 服务工厂导出 ============

export { createDrawioService } from "./drawio-service"
export { createExcalidrawService } from "./excalidraw-service"

// ============ Hooks 导出 ============

export { useDrawioEngine } from "./use-drawio-engine"
export type { UseDrawioEngineReturn } from "./use-drawio-engine"

export { useExcalidrawEngine, sanitizeExcalidrawElements, EMPTY_EXCALIDRAW_SCENE } from "./use-excalidraw-engine"
export type { UseExcalidrawEngineReturn, ExcalidrawScene, ExcalidrawOperation } from "./use-excalidraw-engine"

export { useExcalidrawHistory } from "./use-excalidraw-history"
export type { UseExcalidrawHistoryReturn, UseExcalidrawHistoryOptions } from "./use-excalidraw-history"

export { useEngineSwitch } from "./use-engine-switch"
export type { UseEngineSwitchReturn } from "./use-engine-switch"

// ============ Context 导出 ============

export {
    EngineProvider,
    useEngine,
    useDiagram,
    DiagramProvider,
    EMPTY_EXCALIDRAW_SCENE as EMPTY_SCENE,
    sanitizeExcalidrawElements as sanitizeElements,
} from "./engine-context"
export type { ExcalidrawScene as ContextExcalidrawScene } from "./engine-context"

// ============ 引擎注册表 ============

import type { EngineId, EngineService } from "./types"

/**
 * 引擎注册表
 *
 * 存储所有已注册的引擎服务实例
 */
const engineRegistry = new Map<EngineId, EngineService>()

/**
 * 引擎元数据注册表
 *
 * 存储引擎的静态信息（用于 UI 展示等）
 */
const engineMetaRegistry = new Map<EngineId, { displayName: string }>([
    ["drawio", { displayName: "Draw.io" }],
    ["excalidraw", { displayName: "Excalidraw" }],
])

/**
 * 注册引擎服务实例
 *
 * @param id - 引擎 ID
 * @param service - 引擎服务实例
 */
export function registerEngine(id: EngineId, service: EngineService): void {
    if (engineRegistry.has(id)) {
        console.warn(`[EngineRegistry] Engine "${id}" already registered, replacing...`)
    }
    engineRegistry.set(id, service)
    console.log(`[EngineRegistry] Engine "${id}" registered`)
}

/**
 * 获取引擎服务实例
 *
 * @param id - 引擎 ID
 * @returns 引擎服务实例，如果未注册则返回 undefined
 */
export function getEngine(id: EngineId): EngineService | undefined {
    return engineRegistry.get(id)
}

/**
 * 获取所有已注册的引擎 ID
 *
 * @returns 已注册的引擎 ID 数组
 */
export function getRegisteredEngineIds(): EngineId[] {
    return Array.from(engineRegistry.keys())
}

/**
 * 检查引擎是否已注册
 *
 * @param id - 引擎 ID
 * @returns 是否已注册
 */
export function isEngineRegistered(id: EngineId): boolean {
    return engineRegistry.has(id)
}

/**
 * 获取引擎显示名称
 *
 * @param id - 引擎 ID
 * @returns 显示名称
 */
export function getEngineDisplayName(id: EngineId): string {
    return engineMetaRegistry.get(id)?.displayName || id
}

/**
 * 获取所有引擎元数据
 *
 * @returns 引擎元数据数组
 */
export function getAllEnginesMeta(): Array<{ id: EngineId; displayName: string }> {
    return Array.from(engineMetaRegistry.entries()).map(([id, meta]) => ({
        id,
        ...meta,
    }))
}

/**
 * 清除所有注册的引擎（用于测试）
 */
export function clearEngineRegistry(): void {
    engineRegistry.clear()
}
