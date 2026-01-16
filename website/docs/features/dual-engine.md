---
sidebar_position: 1
---

# Dual Canvas Engine

AGNX Drawer supports two diagram engines for different use cases.

## Draw.io Engine

**Style**: Professional, precise diagrams

**Best for**:
- Architecture diagrams
- Flowcharts
- Cloud infrastructure (AWS, GCP, Azure)
- Technical documentation

**Features**:
- Rich shape libraries
- Cloud provider icons
- PlantUML support
- Export to SVG, PNG, XML

## Excalidraw Engine

**Style**: Hand-drawn, sketch-like diagrams

**Best for**:
- Brainstorming
- Quick sketches
- Informal presentations
- Whiteboard-style diagrams

**Features**:
- Hand-drawn aesthetic
- Mermaid diagram support
- Collaborative feel
- Export to PNG, SVG, JSON

## Switching Engines

Click the engine toggle in the chat panel header to switch between Draw.io and Excalidraw.

Your diagrams are preserved when switching - each engine maintains its own state.

## DSL Support

| Engine | DSL | Example |
|--------|-----|---------|
| Draw.io | PlantUML | `@startuml ... @enduml` |
| Excalidraw | Mermaid | `graph TD; A-->B` |

## Comparison

| Feature | Draw.io | Excalidraw |
|---------|---------|------------|
| Data Format | XML | JSON |
| Style | Professional | Hand-drawn |
| Cloud Icons | ✅ Full support | ❌ Limited |
| DSL | PlantUML | Mermaid |
| Best Use | Documentation | Brainstorming |
