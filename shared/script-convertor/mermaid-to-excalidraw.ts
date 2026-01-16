import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw"

// 使用本地类型定义，因为 @excalidraw/excalidraw/types 不导出 ExcalidrawElement
interface ExcalidrawElement {
    id: string
    type: string
    x: number
    y: number
    width: number
    height: number
    [key: string]: unknown
}

export interface MermaidToExcalidrawOptions {
    /**
     * 是否为深色主题
     */
    isDark?: boolean
    /**
     * 首选描边颜色
     */
    preferredStrokeColor?: string
}

export interface MermaidToExcalidrawResult {
    /**
     * Excalidraw 元素数组
     */
    elements: ExcalidrawElement[]
    /**
     * 可选的文件映射 (用于嵌入图片等)
     */
    files?: Record<string, any>
}

/**
 * 解析主题变量
 */
function resolveThemeVars(isDark: boolean) {
    return isDark
        ? {
              primaryColor: "#ffffff",
              primaryTextColor: "#ffffff",
              primaryBackgroundColor: "#1e1e1e",
          }
        : {
              primaryColor: "#1e1e1e",
              primaryTextColor: "#1e1e1e",
              primaryBackgroundColor: "#ffffff",
          }
}

/**
 * 确保元素拥有有效的 Excalidraw ID
 */
function ensureElementIds(elements: any[]): ExcalidrawElement[] {
    return elements.map((element) => {
        // 如果已有有效 ID，保持不变
        if (element?.id && typeof element.id === "string") {
            return { ...element }
        }
        // 生成新 ID
        return {
            ...element,
            id: `excalidraw-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        }
    })
}

/**
 * 清理和验证 Excalidraw 元素
 * 确保必需字段存在
 */
function sanitizeExcalidrawElements(
    elements: any[],
    options: MermaidToExcalidrawOptions,
): ExcalidrawElement[] {
    return elements.map((element) => {
        const sanitized: any = {
            ...element,
            // 确保必需字段
            version: element?.version ?? 1,
            versionNonce:
                element?.versionNonce ??
                Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
            isDeleted: false,
            // 数值字段
            x: typeof element?.x === "number" ? element.x : 0,
            y: typeof element?.y === "number" ? element.y : 0,
            width: typeof element?.width === "number" ? element.width : 100,
            height: typeof element?.height === "number" ? element.height : 60,
            angle: typeof element?.angle === "number" ? element.angle : 0,
            // 样式字段
            strokeColor: element?.strokeColor || options.preferredStrokeColor || "#1e1e1e",
            backgroundColor: element?.backgroundColor || "transparent",
            fillStyle: element?.fillStyle || "solid",
            strokeWidth: typeof element?.strokeWidth === "number" ? element.strokeWidth : 2,
            strokeStyle: element?.strokeStyle || "solid",
            roughness: typeof element?.roughness === "number" ? element.roughness : 0,
            opacity: typeof element?.opacity === "number" ? element.opacity : 100,
            // 其他常用字段
            roundness:
                element?.roundness !== undefined
                    ? element.roundness
                    : null,
            // 确保 groupIds 和 boundElements 是数组（修复 Excalidraw 崩溃问题）
            groupIds: Array.isArray(element?.groupIds) ? element.groupIds : [],
            boundElements: Array.isArray(element?.boundElements) ? element.boundElements : null,
        }

        return sanitized as ExcalidrawElement
    })
}

/**
 * 将 Mermaid 代码转换为 Excalidraw 元素
 * @param code Mermaid DSL 代码
 * @param options 转换选项
 * @returns Excalidraw 场景数据
 */
export async function convertMermaidToExcalidraw(
    code: string,
    options: MermaidToExcalidrawOptions = {},
): Promise<MermaidToExcalidrawResult> {
    // 预处理: 将字面的 \n 字符串转换为真正的换行符
    // 这解决了 JSON 传输过程中换行符被转义为字面字符串的问题
    let processedCode = code.trim()
    
    // 检测并替换字面的 \n (注意: 这里要避免替换已经正确转义的换行符)
    // 如果代码中包含字面的 "\n" 字符串(两个字符),将其替换为真正的换行符
    if (processedCode.includes('\\n')) {
        processedCode = processedCode.replace(/\\n/g, '\n')
    }
    
    if (!processedCode) {
        throw new Error("Mermaid code is empty")
    }

    try {
        // 调用官方库进行转换
        const parseResult = await parseMermaidToExcalidraw(processedCode, {
            themeVariables: {
                fontSize: "16px",
                ...resolveThemeVars(Boolean(options.isDark)),
            },
        } as any)

        console.log("[Mermaid] Parse result:", {
            elementsCount: parseResult.elements?.length || 0,
            hasFiles: !!parseResult.files,
            firstElement: parseResult.elements?.[0],
            textElements: parseResult.elements?.filter((el: any) => el.type === 'text').length || 0,
            firstTextElement: parseResult.elements?.find((el: any) => el.type === 'text'),
        })

        // 验证转换结果
        if (!parseResult.elements || !Array.isArray(parseResult.elements)) {
            throw new Error("Conversion returned invalid elements (not an array)")
        }

        if (parseResult.elements.length === 0) {
            throw new Error(
                "Conversion returned empty elements array. This may be caused by:\n" +
                "1. Unsupported Mermaid syntax\n" +
                "2. Chinese characters in node labels (known limitation)\n" +
                "3. Complex diagram structures\n\n" +
                "Suggestion: Try using English labels or simpler diagram structure."
            )
        }

        // 清理和验证元素
        const sanitized = sanitizeExcalidrawElements(
            parseResult.elements as any[],
            options,
        )

        // 确保所有元素都有有效 ID
        const normalized = ensureElementIds(sanitized)

        // 将 label 转换为独立的 text 元素
        const withTextElements: any[] = []
        normalized.forEach((element: any) => {
            withTextElements.push(element)
            
            // 如果元素有 label 字段，创建对应的 text 元素
            if (element.label && element.label.text) {
                const textElement = {
                    type: 'text',
                    id: `${element.id}-label`,
                    x: element.x + (element.width || 100) / 2 - 50, // 居中
                    y: element.label.verticalAlign === 'top' 
                        ? element.y + 10 
                        : element.y + (element.height || 60) / 2 - 10,
                    width: 100,
                    height: 25,
                    angle: 0,
                    strokeColor: options.isDark ? '#e2e8f0' : '#1e293b',
                    backgroundColor: 'transparent',
                    fillStyle: 'solid',
                    strokeWidth: 1,
                    strokeStyle: 'solid',
                    roughness: 0,
                    opacity: 100,
                    groupIds: element.label.groupIds || element.groupIds || [],
                    frameId: null,
                    roundness: null,
                    seed: Math.floor(Math.random() * 1000000),
                    version: 1,
                    versionNonce: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
                    isDeleted: false,
                    boundElements: null,
                    updated: Date.now(),
                    link: null,
                    locked: false,
                    text: element.label.text,
                    fontSize: element.label.fontSize || 16,
                    fontFamily: 2, // Helvetica
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    baseline: element.label.fontSize || 16,
                    containerId: null,
                    originalText: element.label.text,
                    lineHeight: 1.25,
                }
                withTextElements.push(textElement)
                
                // 删除原始元素的 label 字段
                delete element.label
            }
        })

        console.log("[Mermaid] Successfully converted:", {
            elementsCount: withTextElements.length,
            originalElements: normalized.length,
            elementTypes: [...new Set(withTextElements.map((e: any) => e.type))],
            textElements: withTextElements.filter((e: any) => e.type === 'text').length,
        })

        return {
            elements: withTextElements as ExcalidrawElement[],
            files: parseResult.files,
        }
    } catch (error) {
        console.error("[Mermaid] Conversion failed:", {
            error,
            code: processedCode.slice(0, 200) + (processedCode.length > 200 ? '...' : ''),
        })
        throw new Error(
            `Failed to convert Mermaid to Excalidraw: ${error instanceof Error ? error.message : String(error)}`,
        )
    }
}
