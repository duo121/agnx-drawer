---
name: excalidraw-flowchart
description: Create flowcharts and process diagrams with Excalidraw. Use this skill for decision trees, process flows, user journeys, workflow diagrams, algorithms, or any sequential diagram with connected nodes and decision points.
engine: excalidraw
---

# Excalidraw Flowchart Guide

## Overview

This skill provides patterns and best practices for creating flowcharts and process diagrams using Excalidraw's hand-drawn style.

## Flowchart Shapes

| Shape | Usage | Excalidraw Type |
|-------|-------|-----------------|
| Rounded Rectangle | Start/End | `rectangle` with label |
| Rectangle | Process/Action | `rectangle` with label |
| Diamond | Decision | `diamond` with label |
| Ellipse | Connector | `ellipse` with label |

## Common Patterns

### Linear Process

```typescript
[
  { type: "rectangle", id: "step1", x: 50, y: 100, width: 150, height: 60,
    backgroundColor: "#b2f2bb", label: { text: "Step 1" } },
  { type: "rectangle", id: "step2", x: 250, y: 100, width: 150, height: 60,
    backgroundColor: "#a5d8ff", label: { text: "Step 2" } },
  { type: "rectangle", id: "step3", x: 450, y: 100, width: 150, height: 60,
    backgroundColor: "#a5d8ff", label: { text: "Step 3" } },
  { type: "rectangle", id: "step4", x: 650, y: 100, width: 150, height: 60,
    backgroundColor: "#ffc9c9", label: { text: "End" } },

  { type: "arrow", start: { id: "step1" }, end: { id: "step2" } },
  { type: "arrow", start: { id: "step2" }, end: { id: "step3" } },
  { type: "arrow", start: { id: "step3" }, end: { id: "step4" } }
]
```

### Decision Tree

```typescript
[
  // Start
  { type: "ellipse", id: "start", x: 200, y: 30, width: 100, height: 50,
    backgroundColor: "#b2f2bb", label: { text: "Start" } },

  // Decision
  { type: "diamond", id: "decision", x: 175, y: 130, width: 150, height: 100,
    backgroundColor: "#ffec99", label: { text: "Condition?" } },

  // Yes path
  { type: "rectangle", id: "yes-action", x: 50, y: 280, width: 150, height: 60,
    backgroundColor: "#a5d8ff", label: { text: "Yes Action" } },

  // No path
  { type: "rectangle", id: "no-action", x: 300, y: 280, width: 150, height: 60,
    backgroundColor: "#a5d8ff", label: { text: "No Action" } },

  // End
  { type: "ellipse", id: "end", x: 200, y: 400, width: 100, height: 50,
    backgroundColor: "#ffc9c9", label: { text: "End" } },

  // Arrows
  { type: "arrow", start: { id: "start" }, end: { id: "decision" } },
  { type: "arrow", start: { id: "decision" }, end: { id: "yes-action" }, label: { text: "Yes" } },
  { type: "arrow", start: { id: "decision" }, end: { id: "no-action" }, label: { text: "No" } },
  { type: "arrow", start: { id: "yes-action" }, end: { id: "end" } },
  { type: "arrow", start: { id: "no-action" }, end: { id: "end" } }
]
```

### Loop Pattern

```typescript
[
  { type: "ellipse", id: "start", x: 200, y: 30, width: 100, height: 50,
    backgroundColor: "#b2f2bb", label: { text: "Start" } },

  { type: "rectangle", id: "process", x: 175, y: 120, width: 150, height: 60,
    backgroundColor: "#a5d8ff", label: { text: "Process" } },

  { type: "diamond", id: "check", x: 175, y: 230, width: 150, height: 100,
    backgroundColor: "#ffec99", label: { text: "Done?" } },

  { type: "ellipse", id: "end", x: 200, y: 380, width: 100, height: 50,
    backgroundColor: "#ffc9c9", label: { text: "End" } },

  { type: "arrow", start: { id: "start" }, end: { id: "process" } },
  { type: "arrow", start: { id: "process" }, end: { id: "check" } },
  { type: "arrow", start: { id: "check" }, end: { id: "end" }, label: { text: "Yes" } },
  { type: "arrow", start: { id: "check" }, end: { id: "process" }, label: { text: "No" } }
]
```

### Parallel Processes

```typescript
[
  { type: "rectangle", id: "start", x: 200, y: 30, width: 150, height: 60,
    backgroundColor: "#b2f2bb", label: { text: "Start" } },

  // Parallel branches
  { type: "rectangle", id: "branch-a", x: 50, y: 150, width: 120, height: 60,
    backgroundColor: "#a5d8ff", label: { text: "Task A" } },
  { type: "rectangle", id: "branch-b", x: 215, y: 150, width: 120, height: 60,
    backgroundColor: "#a5d8ff", label: { text: "Task B" } },
  { type: "rectangle", id: "branch-c", x: 380, y: 150, width: 120, height: 60,
    backgroundColor: "#a5d8ff", label: { text: "Task C" } },

  { type: "rectangle", id: "merge", x: 200, y: 270, width: 150, height: 60,
    backgroundColor: "#d0bfff", label: { text: "Merge" } },

  // Arrows
  { type: "arrow", start: { id: "start" }, end: { id: "branch-a" } },
  { type: "arrow", start: { id: "start" }, end: { id: "branch-b" } },
  { type: "arrow", start: { id: "start" }, end: { id: "branch-c" } },
  { type: "arrow", start: { id: "branch-a" }, end: { id: "merge" } },
  { type: "arrow", start: { id: "branch-b" }, end: { id: "merge" } },
  { type: "arrow", start: { id: "branch-c" }, end: { id: "merge" } }
]
```

## Color Conventions

| Element | Color | Hex |
|---------|-------|-----|
| Start | Green | `#b2f2bb` |
| End | Red/Pink | `#ffc9c9` |
| Process | Blue | `#a5d8ff` |
| Decision | Yellow | `#ffec99` |
| Merge/Join | Purple | `#d0bfff` |
| Connector | Gray | `#dee2e6` |

## Layout Guidelines

### Spacing
- Vertical spacing: 80-120px between rows
- Horizontal spacing: 50-100px between columns
- Element width: 120-180px
- Element height: 50-80px

### Flow Direction
- Primary: Top to bottom
- Alternative: Left to right
- Decision branches: Left/Right from diamond

### Alignment
- Center-align elements in each column
- Keep consistent widths for same-type elements
- Align arrow endpoints to element centers

## Best Practices

1. **Use consistent colors** for same element types
2. **Label all decision branches** (Yes/No, True/False)
3. **Keep text concise** - one action per box
4. **Avoid crossing arrows** - use connectors if needed
5. **Group related steps** using frames
6. **Start with Start, end with End** - clear entry/exit points

## Examples

- "Draw a user registration flowchart"
- "Create an order processing workflow"
- "Design a bug triage decision tree"
- "Draw an authentication flow with error handling"
- "Create a CI/CD pipeline diagram"
