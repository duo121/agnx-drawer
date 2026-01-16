/**
 * 引擎服务层类型定义
 *
 * 定义统一的引擎服务接口，所有绘图引擎（DrawIO、Excalidraw 等）都需要实现此接口。
 * 这样可以在不修改上层代码的情况下轻松添加新引擎。
 */

// ============ 基础类型 ============

/** 引擎 ID */
export type EngineId = "drawio" | "excalidraw"

/** 历史记录条目（统一格式） */
export interface HistoryEntry {
    /** 时间戳 */
    timestamp: number
    /** 缩略图（base64 SVG 或 data URL） */
    thumbnailDataUrl?: string
    /** 是否为手动保存 */
    isManual?: boolean
    /** 标签（用于标识版本） */
    label?: string
}

/** 导出格式 */
export type ExportFormat = "png" | "svg" | "drawio" | "excalidraw" | "json"

// ============ 服务接口 ============

/**
 * 引擎服务接口
 *
 * 定义所有绘图引擎必须实现的通用功能。
 * 专属功能不在此接口中定义，通过各引擎的专属 Hook 提供。
 */
export interface EngineService {
    /** 引擎 ID */
    readonly id: EngineId

    /** 引擎显示名称 */
    readonly displayName: string

    // ========== 生命周期 ==========

    /** 引擎是否就绪 */
    readonly isReady: boolean

    /** 设置就绪状态 */
    setReady(ready: boolean): void

    /** 重置就绪状态（用于引擎重新加载） */
    resetReady(): void

    // ========== 画布操作 ==========

    /** 清空画布 */
    clear(): void | Promise<void>

    /** 选择元素 */
    selectElements(ids?: string[]): void

    /** 获取缩略图（base64 SVG） */
    getThumbnailSvg(): Promise<string | null>

    // ========== 历史记录 ==========

    /** 获取历史记录列表 */
    getHistory(): HistoryEntry[]

    /** 推送历史记录 */
    pushHistory(label?: string, isManual?: boolean): void | Promise<void>

    /** 删除历史记录 */
    deleteHistory(index: number): void

    /** 恢复历史记录 */
    restoreHistory(index: number): void | Promise<void>

    /** 初始化历史记录（从存储加载） */
    initHistory(entries: HistoryEntry[]): void

    /** 清空历史记录 */
    clearHistory(): void

    /**
     * 设置历史变更回调（用于同步到 React 状态）
     * 注意：回调参数为引擎特定的历史条目类型
     */
    setOnHistoryChange(callback: ((history: any[]) => void) | null): void
}

// ============ 服务工厂 ============

/**
 * 引擎服务依赖
 *
 * 创建引擎服务时需要注入的依赖（来自 Hook 或其他来源）
 */
export interface EngineServiceDeps {
    // 通用依赖可以在这里定义
}

/**
 * DrawIO 服务依赖
 */
export interface DrawioServiceDeps extends EngineServiceDeps {
    /** DrawIO 组件引用 */
    drawioRef: React.RefObject<any>
    /** 导出解析器引用 */
    resolverRef: React.RefObject<((value: string) => void) | null>
    /** XML 状态引用 */
    chartXMLRef: React.MutableRefObject<string>
    /** 获取最新 SVG */
    getLatestSvg: () => string
    /** 加载图表 */
    loadDiagram: (xml: string, skipValidation?: boolean) => string | null
}

/**
 * Excalidraw 服务依赖
 */
export interface ExcalidrawServiceDeps extends EngineServiceDeps {
    /** Excalidraw API 引用 */
    apiRef: React.RefObject<any>
    /** 场景引用 */
    sceneRef: React.RefObject<any>
    /** 获取场景 */
    getScene: () => any
    /** 设置场景 */
    setScene: (scene: any) => void | Promise<void>
    /** 获取缩略图 */
    getThumbnailSvg: () => Promise<string | null>
}

// ============ 注册表类型 ============

/**
 * 引擎服务工厂函数
 */
export type EngineServiceFactory<T extends EngineServiceDeps = EngineServiceDeps> = (
    deps: T
) => EngineService

/**
 * 引擎注册表条目
 */
export interface EngineRegistryEntry {
    id: EngineId
    displayName: string
    factory: EngineServiceFactory<any>
}
