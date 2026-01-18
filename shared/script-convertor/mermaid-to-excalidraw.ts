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
        // 调用官方库进行转换 - 返回 skeleton format
        const parseResult = await parseMermaidToExcalidraw(processedCode, {
            themeVariables: {
                fontSize: "16px",
                ...resolveThemeVars(Boolean(options.isDark)),
            },
        } as any)

        console.log("[Mermaid] Parse result (skeleton):", {
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

        // 将 skeleton format 转换为完全合格的 excalidraw 元素
        // 这一步会正确测量文本尺寸、处理绑定关系、创建绑定的文本元素等
        // 注意：此函数只能在浏览器环境中调用，因为依赖 DOM API
        let finalElements: any[] = []
        
        try {
            const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw")
            
            const convertedElements = convertToExcalidrawElements(parseResult.elements as any[])
            
            console.log("[Mermaid] Raw converted elements:", {
                elementsCount: convertedElements?.length || 0,
                textElements: convertedElements?.filter((el: any) => el.type === 'text').length || 0,
                boundTextCount: convertedElements?.filter((el: any) => el.type === 'text' && el.containerId).length || 0,
                unboundTextCount: convertedElements?.filter((el: any) => el.type === 'text' && !el.containerId).length || 0,
            })
            
            // 过滤掉没有绑定到容器的重复文本元素
            // convertToExcalidrawElements 会从带 label 的容器创建绑定文本 (containerId 不为空)
            // 但也会保留原始 skeleton 中的独立 text 元素 (containerId 为空)
            // 这导致文字重复，需要过滤
            const boundTextContents = new Set(
                convertedElements
                    .filter((el: any) => el.type === 'text' && el.containerId)
                    .map((el: any) => el.text)
            )
            
            finalElements = convertedElements.filter((el: any) => {
                // 保留所有非 text 元素
                if (el.type !== 'text') return true
                // 保留绑定到容器的文本
                if (el.containerId) return true
                // 对于未绑定的文本，如果存在同样内容的绑定文本，则过滤掉
                if (boundTextContents.has(el.text)) {
                    console.log("[Mermaid] Filtering duplicate unbound text:", el.text)
                    return false
                }
                return true
            })
            
            console.log("[Mermaid] After filtering duplicates:", {
                elementsCount: finalElements?.length || 0,
                textElements: finalElements?.filter((el: any) => el.type === 'text').length || 0,
                textContents: finalElements?.filter((el: any) => el.type === 'text').map((el: any) => ({
                    text: el.text,
                    containerId: el.containerId || 'none',
                })),
            })
        } catch (conversionError) {
            console.warn("[Mermaid] convertToExcalidrawElements failed, falling back to sanitize:", conversionError)
            // 只有在 convertToExcalidrawElements 失败时才使用 sanitize
            finalElements = sanitizeExcalidrawElements(parseResult.elements as any[], options)
            finalElements = ensureElementIds(finalElements)
        }

        // convertToExcalidrawElements 返回的已经是完整元素，不需要再处理
        console.log("[Mermaid] Successfully converted:", {
            elementsCount: finalElements.length,
            elementTypes: [...new Set(finalElements.map((e: any) => e.type))],
            textElements: finalElements.filter((e: any) => e.type === 'text').length,
        })

        return {
            elements: finalElements as ExcalidrawElement[],
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
