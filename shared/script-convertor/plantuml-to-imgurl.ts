import { deflateRaw } from "zlib"
import { promisify } from "util"

const deflateRawAsync = promisify(deflateRaw)

export const PLANTUML_THEMES = [
    "amiga",
    "aws-orange",
    "black-knight",
    "bluegray",
    "blueprint",
    "cerulean-outline",
    "cerulean",
    "crt-amber",
    "crt-green",
    "cyborg-outline",
    "cyborg",
    "hacker",
    "lightgray",
    "mars",
    "materia-outline",
    "materia",
    "metal",
    "mimeograph",
    "minty",
    "plain",
    "reddress-darkblue",
    "reddress-darkgreen",
    "reddress-darkorange",
    "reddress-darkred",
    "reddress-lightblue",
    "reddress-lightgreen",
    "reddress-lightorange",
    "reddress-lightred",
    "sandstone",
    "silver",
    "sketchy-outline",
    "sketchy",
    "spacelab",
    "spacelab-white",
    "superhero-outline",
    "superhero",
    "toy",
    "united",
    "vibrant",
] as const

export type PlantUMLTheme = (typeof PLANTUML_THEMES)[number]

export const PLANTUML_FORMATS = ["svg", "png", "txt", "uml"] as const
export type PlantUMLFormat = (typeof PLANTUML_FORMATS)[number]

const PLANTUML_ALPHABET =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_"

function encodePlantUMLBase64(data: Buffer): string {
    let result = ""
    let i = 0
    const length = data.length

    while (i < length) {
        const byte1 = data[i++]
        const byte2 = i < length ? data[i++] : 0
        const byte3 = i < length ? data[i++] : 0

        const bits = (byte1 << 16) | (byte2 << 8) | byte3

        result += PLANTUML_ALPHABET[(bits >> 18) & 0x3f]
        result += PLANTUML_ALPHABET[(bits >> 12) & 0x3f]
        result += PLANTUML_ALPHABET[(bits >> 6) & 0x3f]
        result += PLANTUML_ALPHABET[bits & 0x3f]
    }

    return result
}

export interface EncodePlantUMLOptions {
    theme?: PlantUMLTheme | string
    format?: PlantUMLFormat
    server?: string
}

export async function encodePlantUML(
    text: string,
    options?: EncodePlantUMLOptions,
): Promise<string> {
    const format = options?.format || "svg"
    const server = options?.server || "https://www.plantuml.com/plantuml"
    let finalText = text

    if (options?.theme) {
        const startumlMatch = finalText.match(/^@startuml/m)
        if (startumlMatch) {
            finalText = finalText.replace(
                /^(@startuml.*?)$/m,
                `$1\n!theme ${options.theme}`,
            )
        } else {
            finalText = `@startuml\n!theme ${options.theme}\n${finalText}\n@enduml`
        }
    }

    const utf8Buffer = Buffer.from(finalText, "utf-8")
    const compressed = await deflateRawAsync(utf8Buffer)
    const encoded = encodePlantUMLBase64(compressed)

    return `${server}/${format}/${encoded}`
}

export function encodePlantUMLHex(text: string): string {
    const hex = Buffer.from(text, "utf-8").toString("hex").toUpperCase()
    return `~h${hex}`
}
