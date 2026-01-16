import {PlantUMLParser, DrawioGenerator} from "./plantuml-to-drawio";
import {convertC4ToDrawio, detectC4} from "./plantuml-c4-to-drawio";

export {PlantUMLParser, DrawioGenerator} from "./plantuml-to-drawio";

export {
  encodePlantUML,
  encodePlantUMLHex,
  PLANTUML_FORMATS,
  PLANTUML_THEMES,
  type PlantUMLFormat,
  type PlantUMLTheme,
  type EncodePlantUMLOptions,
} from "./plantuml-to-imgurl";

export {
  encodeMermaid,
  buildMermaidImgUrl,
  type MermaidFormat,
  type EncodeMermaidOptions,
} from "./mermaid-to-imgurl";

export {
  convertMermaidToExcalidraw,
  type MermaidToExcalidrawOptions,
  type MermaidToExcalidrawResult,
} from "./mermaid-to-excalidraw";

export async function convertPlantUMLToDrawio(code: string, compressed = false): Promise<string> {
  const trimmed = code?.trim();
  if (!trimmed) {
    throw new Error("PlantUML code is empty");
  }

  if (detectC4(trimmed)) {
    return convertC4ToDrawio(trimmed, {compressed});
  }

  const parser = new PlantUMLParser(trimmed);
  const parsed = parser.parse();
  const generator = new DrawioGenerator(parsed);
  return generator.generate(compressed);
}
