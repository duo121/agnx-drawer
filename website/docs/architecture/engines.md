---
sidebar_position: 2
---

# Diagram Engines

The dual-engine architecture allows flexible diagram creation.

## Engine Interface

Each engine implements a common interface:

```typescript
interface DiagramEngine {
  id: string                    // "drawio" | "excalidraw"
  name: string                  // Display name
  dataFormat: "xml" | "json"    // Data format

  getSystemPrompt(): string     // AI system prompt
  getTools(): Record<string, Tool>  // AI tools
  
  // Optional
  EditorComponent?: React.ComponentType
  handleToolCall?: (call, context) => Promise<void>
  export?: (format, context) => Promise<any>
}
```

## Draw.io Engine

**Data Format**: XML (mxCell)

**Tools**:
- `display_diagram` - Show new diagram
- `edit_diagram` - Modify existing diagram
- `append_diagram` - Continue truncated XML
- `convert_plantuml_to_drawio` - PlantUML conversion
- `get_shape_library` - Get shape documentation

**System Prompt**: Instructs AI to generate valid draw.io XML with proper mxCell structure.

## Excalidraw Engine

**Data Format**: JSON (elements array)

**Tools**:
- `display_excalidraw` - Show new scene
- `edit_excalidraw` - Modify scene (replace/patch/delete)
- `append_excalidraw` - Continue truncated elements
- `convert_mermaid_to_excalidraw` - Mermaid conversion

**Operations**:
```typescript
type ExcalidrawOperation =
  | { operation: "replace_elements"; elements: any[] }
  | { operation: "patch_elements"; elements: any[] }
  | { operation: "delete_elements"; ids: string[] }
```

## Engine Registry

Engines are registered in a central registry:

```typescript
const engines = new Map([
  ["drawio", DrawioEngine],
  ["excalidraw", ExcalidrawEngine],
])

export function getEngine(id: string): DiagramEngine {
  return engines.get(id) ?? DrawioEngine
}
```

## Adding New Engines

1. Create engine directory in `lib/diagram-engines/`
2. Implement `DiagramEngine` interface
3. Register in `registry.ts`

```typescript
// lib/diagram-engines/miro/index.ts
export const MiroEngine: DiagramEngine = {
  id: "miro",
  name: "Miro",
  dataFormat: "json",
  getSystemPrompt: () => "...",
  getTools: () => ({ /* ... */ }),
}
```
