---
name: excalidraw-basics
description: Excalidraw diagram creation guide. Use this skill when creating diagrams with Excalidraw engine, including basic shapes, text, arrows, connections, and hand-drawn style diagrams. Covers element types, bindings, styling, and the Skeleton API.
engine: excalidraw
---

# Excalidraw Diagram Guide

## Overview

Excalidraw uses a simplified Skeleton API for creating elements programmatically. Elements are defined as JSON objects and converted to full Excalidraw elements.

## Element Types

### Basic Shapes

```typescript
// Rectangle
{ type: "rectangle", x: 100, y: 100, width: 200, height: 100 }

// Ellipse (circle/oval)
{ type: "ellipse", x: 100, y: 100, width: 200, height: 100 }

// Diamond
{ type: "diamond", x: 100, y: 100, width: 200, height: 100 }
```

### Text

```typescript
// Standalone text
{ type: "text", x: 100, y: 100, text: "Hello World" }

// Multi-line text
{ type: "text", x: 100, y: 100, text: "Line 1\nLine 2\nLine 3" }
```

### Text Containers (Shape with Label)

```typescript
// Rectangle with centered label
{
  type: "rectangle",
  x: 100,
  y: 100,
  width: 200,
  height: 80,
  label: { text: "Container Label" }
}

// Diamond with label
{
  type: "diamond",
  x: 100,
  y: 100,
  width: 150,
  height: 100,
  label: { text: "Decision?" }
}
```

### Arrows and Lines

```typescript
// Basic arrow
{ type: "arrow", x: 100, y: 100, width: 200, height: 0 }

// Line (no arrowhead)
{ type: "line", x: 100, y: 100, width: 200, height: 0 }

// Arrow with label
{
  type: "arrow",
  x: 100,
  y: 100,
  width: 200,
  height: 50,
  label: { text: "connects to" }
}
```

### Arrow Bindings (Connections)

```typescript
// Arrow connecting two NEW shapes (inline definition)
{
  type: "arrow",
  x: 200,
  y: 150,
  start: { type: "rectangle", x: 50, y: 100, width: 100, height: 60, label: { text: "Start" } },
  end: { type: "ellipse", x: 300, y: 100, width: 100, height: 60, label: { text: "End" } }
}

// Arrow connecting to EXISTING elements by ID
{
  type: "arrow",
  x: 200,
  y: 150,
  start: { id: "rect-1" },
  end: { id: "ellipse-1" }
}
```

## Styling

### Colors

```typescript
{
  type: "rectangle",
  x: 100,
  y: 100,
  width: 200,
  height: 100,
  backgroundColor: "#a5d8ff",  // Fill color
  strokeColor: "#1971c2"       // Border color
}
```

### Common Colors
- Blue: `#a5d8ff` (light), `#1971c2` (dark)
- Green: `#b2f2bb` (light), `#2f9e44` (dark)
- Red: `#ffc9c9` (light), `#e03131` (dark)
- Yellow: `#ffec99` (light), `#f08c00` (dark)
- Purple: `#d0bfff` (light), `#7950f2` (dark)
- Gray: `#dee2e6` (light), `#495057` (dark)

### Stroke Styles

```typescript
{
  type: "rectangle",
  strokeWidth: 2,              // 1, 2, or 4
  strokeStyle: "solid",        // solid, dashed, dotted
  fillStyle: "hachure"         // hachure, cross-hatch, solid
}
```

### Roughness

```typescript
{
  type: "rectangle",
  roughness: 1                 // 0 = smooth, 1 = normal, 2 = rough
}
```

## Frames (Grouping)

```typescript
[
  { type: "rectangle", id: "box1", x: 10, y: 10, width: 100, height: 60 },
  { type: "diamond", id: "box2", x: 120, y: 20, width: 80, height: 60 },
  { type: "frame", children: ["box1", "box2"], name: "My Group" }
]
```

## Layout Tips

### Spacing
- Maintain 50-100px between elements
- Use consistent widths (e.g., 150px for all boxes)
- Align elements on a virtual grid

### Positioning
- x increases to the right
- y increases downward
- (0, 0) is top-left corner

### Element Sizing
- Small: 80x50
- Medium: 150x80
- Large: 200x100

## Best Practices

1. **Use labels** for text inside shapes instead of separate text elements
2. **Provide unique IDs** when elements need to be referenced by arrows
3. **Use arrow bindings** for connected diagrams (cleaner than manual positioning)
4. **Keep roughness consistent** across the diagram
5. **Use frames** to group related elements
6. **Align elements** for professional appearance

## Examples

- "Draw a simple flowchart with three steps"
- "Create a mind map with a central topic and branches"
- "Design a system architecture with connected components"
- "Draw an org chart with boxes and connecting lines"
