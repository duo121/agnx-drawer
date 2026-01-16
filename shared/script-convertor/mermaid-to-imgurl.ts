import { deflate } from "zlib"
import { promisify } from "util"

const deflateAsync = promisify(deflate)

export type MermaidFormat = "png" | "svg"

export interface EncodeMermaidOptions {
    /**
     * 输出格式，默认为 png
     */
    format?: MermaidFormat
    /**
     * 自定义服务端基础地址
     * - mermaid.ink: https://mermaid.ink/img/pako:{encoded}?type=png&width=...
     * - kroki: https://kroki.io/mermaid/{format}/{encoded}?width=...
     */
    baseUrl?: string
    /**
     * 选择服务端，默认 mermaid.ink，可设为 "kroki"
     */
    server?: "mermaid" | "kroki"
    /**
     * 可选尺寸参数
     */
    width?: number
    height?: number
}

function encodeMermaidBase64(data: Buffer): string {
    // 标准 base64，再 URL 安全化
    return data
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
}

export async function encodeMermaid(text: string): Promise<string> {
    // 构建 mermaid.ink 需要的完整 JSON 对象
    const payload = {
        code: text.trim(),
        mermaid: { theme: "default" },
    }
    const utf8Buffer = Buffer.from(JSON.stringify(payload), "utf-8")
    const compressed = await deflateAsync(utf8Buffer)
    return encodeMermaidBase64(compressed)
}

export async function buildMermaidImgUrl(
    code: string,
    options: EncodeMermaidOptions = {},
): Promise<string> {
    const encoded = await encodeMermaid(code)
    const format: MermaidFormat = options.format || "png"
    const server = options.server || "mermaid"
    const width = options.width
    const height = options.height

    if (server === "kroki") {
        const base = options.baseUrl || "https://kroki.io"
        const params = new URLSearchParams()
        if (width) params.set("width", String(width))
        if (height) params.set("height", String(height))
        const query = params.toString()
        return `${base}/mermaid/${format}/${encoded}${query ? `?${query}` : ""}`
    }

    // 默认 mermaid.ink
    const base = options.baseUrl || "https://mermaid.ink"
    const params = new URLSearchParams({ type: format })
    if (width) params.set("width", String(width))
    if (height) params.set("height", String(height))
    return `${base}/img/pako:${encoded}?${params.toString()}`
}
