---
name: flowchart
description: Flowcharts and process diagrams. Use this skill when creating flowcharts, process flows, decision trees, workflow diagrams, algorithms, business processes, or any diagram with sequential steps, decisions, and flow arrows.
engine: drawio
---

# Flowchart Diagrams

## Overview

This skill provides standard flowchart shapes for creating process flows, decision trees, and workflow diagrams using Draw.io.

## Standard Flowchart Shapes

### Basic Shapes

```xml
<!-- Terminator (Start/End) - Rounded rectangle -->
<mxCell style="rounded=1;whiteSpace=wrap;arcSize=50;" />

<!-- Process (Action) - Rectangle -->
<mxCell style="rounded=0;whiteSpace=wrap;" />

<!-- Decision - Diamond -->
<mxCell style="rhombus;whiteSpace=wrap;" />

<!-- Data (I/O) - Parallelogram -->
<mxCell style="shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;" />

<!-- Document -->
<mxCell style="shape=document;whiteSpace=wrap;boundedLbl=1;" />

<!-- Predefined Process (Subroutine) -->
<mxCell style="shape=process;whiteSpace=wrap;backgroundOutline=1;" />

<!-- Manual Input -->
<mxCell style="shape=manualInput;whiteSpace=wrap;" />

<!-- Preparation -->
<mxCell style="shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;" />

<!-- Connector (Circle) -->
<mxCell style="ellipse;whiteSpace=wrap;aspect=fixed;" />
```

## Shape Meanings

| Shape | Name | Usage |
|-------|------|-------|
| Rounded Rectangle | Terminator | Start/End points |
| Rectangle | Process | Action or operation |
| Diamond | Decision | Yes/No or branching |
| Parallelogram | Data | Input/Output |
| Document | Document | Document or report |
| Double-sided Rectangle | Predefined Process | Subroutine or function call |
| Trapezoid | Manual Input | User input |
| Hexagon | Preparation | Setup or initialization |
| Circle | Connector | Flow continuation |
| Cylinder | Database | Data storage |

## Flow Arrow Conventions

### Direction
- Top to bottom (primary flow)
- Left to right (alternative)
- Arrows indicate flow direction

### Decision Branches
- "Yes" typically goes down or right
- "No" typically goes left or down
- Label all decision branches

### Connectors
- Use circles with letters/numbers for reaks
- Match connectors to continue flow

## Common Patterns

### Sequential Process
```
Start → Process 1 → Process 2 → Process 3 → End
```

### Decision Branch
```
        ┌─ Yes → Process A ─┐
Decision┤                    ├→ Continue
        └─ No  → Process B ─┘
```

### Loop
```
Start → Process → Decision ─ No ─┐
                     │           │
                    Yes          │
                     ↓           │
                   End    ←──────┘
```

### Parallel Processes
```
        ┌→ Process A ─┐
Split ──┼→ Process B ─┼→ Merge
        └→ Process C ─┘
```

## Best Practices

1. **Start with one entry point** - Single "Start" terminator
2. **End with clear exit points** - One or more "End" terminators
3. **Keep it simple** - One action per process box
4. **Label decisions clearly** - Use Yes/No or specific conditions
5. **Maintain consistent flow** - Top-to-bottom, left-to-right
6. **Use connectors for complex flows** - Avoid crossing lines
7. **Align shapes** - Use grid alignment for clean appearance

## Color Conventions

- Start/End: Green (`#00AA00`) / Red (`#CC0000`)
- Process: Blue (`#0066CC`)
- Decision: Yellow/Orange (`#FFCC00`)
- Data: Light blue (`#87CEEB`)
- Document: White with border

## Swimlane Diagrams

For cross-functional flowcharts:
```
┌─────────────┬─────────────┬─────────────┐
│  Customer   │   Sales     │  Warehouse  │
├─────────────┼─────────────┼─────────────┤
│   Order     │             │             │
│     ↓       │             │             │
│             │  Process    │             │
│             │     ↓       │             │
│             │             │   Ship      │
│             │             │     ↓       │
│  Receive    │             │             │
└─────────────┴─────────────┴─────────────┘
```

## Examples

- "Draw a user login flowchart with password validation"
- "Create an order processing workflow from order to delivery"
- "Design a decision tree for customer support escalation"
- "Draw an algorithm flowchart for binary search"
- "Create a swimlane diagraase approval process"
