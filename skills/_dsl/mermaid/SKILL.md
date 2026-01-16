---
name: mermaid-dsl
description: Mermaid DSL 语法参考。当用户使用 /mermaid 命令或提供 Mermaid 代码时加载。支持流程图、序列图、类图、状态图、ER图、甘特图、饼图、思维导图。
engine: excalidraw
---

# Mermaid DSL Reference

Mermaid is a text-based DSL for creating diagrams. Use `convert_mermaid_to_excalidraw` tool to convert Mermaid code to Excalidraw elements with hand-drawn style.

## Supported Diagram Types

- Flowchart / Graph
- Sequence Diagram
- Class Diagram
- State Diagram
- Entity-Relationship Diagram
- Gantt Chart
- Pie Chart
- Mind Map

## Basic Syntax

### Flowchart
```mermaid
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process A]
    B -->|No| D[Process B]
    C --> E[End]
    D --> E
```

**Direction options:**
- `TD` / `TB` - Top to bottom
- `BT` - Bottom to top
- `LR` - Left to right
- `RL` - Right to left

**Node shapes:**
- `[text]` - Rectangle
- `(text)` - Rounded rectangle
- `{text}` - Diamond (decision)
- `([text])` - Stadium
- `[[text]]` - Subroutine
- `[(text)]` - Cylinder (database)
- `((text))` - Circle

### Sequence Diagram
```mermaid
sequenceDiagram
    actor User
    participant App
    participant API
    participant DB
    
    User->>App: Login request
    App->>API: Authenticate
    API->>DB: Query user
    DB-->>API: User data
    API-->>App: Auth token
    App-->>User: Login success
```

**Arrow types:**
- `->` Solid line
- `-->` Dotted line
- `->>` Solid with arrowhead
- `-->>` Dotted with arrowhead
- `-x` Solid with cross
- `--x` Dotted with cross

### Class Diagram
```mermaid
classDiagram
    class User {
        +int id
        +String name
        +String email
        +login()
        +logout()
    }
    
    class Order {
        +int orderId
        +Decimal total
        +createOrder()
        +cancelOrder()
    }
    
    User "1" --> "*" Order : places
```

**Relationships:**
- `<|--` Inheritance
- `*--` Composition
- `o--` Aggregation
- `-->` Association
- `--` Link (solid)
- `..>` Dependency
- `..|>` Realization

### State Diagram
```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Submitted : submit
    Submitted --> Approved : approve
    Submitted --> Rejected : reject
    Approved --> [*]
    Rejected --> Draft : revise
```

### ER Diagram
```mermaid
erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    PRODUCT ||--o{ LINE-ITEM : "ordered in"
    
    USER {
        int id PK
        string name
        string email
    }
    ORDER {
        int id PK
        int user_id FK
        decimal total
    }
```

**Cardinality:**
- `||` exactly one
- `o|` zero or one
- `}|` one or more
- `}o` zero or more

### Gantt Chart
```mermaid
gantt
    title Project Timeline
    dateFormat  YYYY-MM-DD
    
    section Planning
    Requirements    :a1, 2024-01-01, 7d
    Design          :a2, after a1, 14d
    
    section Development
    Backend         :b1, after a2, 21d
    Frontend        :b2, after a2, 21d
    
    section Testing
    QA Testing      :c1, after b1, 7d
```

### Pie Chart
```mermaid
pie title Browser Market Share
    "Chrome" : 65
    "Safari" : 19
    "Firefox" : 10
    "Edge" : 4
    "Other" : 2
```

### Mind Map
```mermaid
mindmap
  root((Project))
    Planning
      Requirements
      Timeline
    Development
      Frontend
      Backend
    Testing
      Unit Tests
      Integration
```

## Styling

### Inline Styles
```mermaid
flowchart TD
    A[Start]:::green --> B{Check}:::yellow
    B -->|Yes| C[Success]:::blue
    B -->|No| D[Fail]:::red
    
    classDef green fill:#b2f2bb,stroke:#2f9e44
    classDef yellow fill:#ffec99,stroke:#f08c00
    classDef blue fill:#a5d8ff,stroke:#1971c2
    classDef red fill:#ffc9c9,stroke:#e03131
```

### Subgraphs
```mermaid
flowchart TD
    subgraph Frontend
        A[React App]
        B[Vue App]
    end
    subgraph Backend
        C[API Server]
        D[Database]
    end
    A --> C
    B --> C
    C --> D
```

## Usage Tips

1. **No wrapper tags needed** - Unlike PlantUML, Mermaid doesn't require start/end tags in simple cases
2. **Direction matters** - Choose appropriate flow direction for readability
3. **Use subgraphs** to group related nodes
4. **Label edges** with `|label|` syntax in flowcharts
5. **Use aliases** for long node names: `A[Long Name] --> B`

## Examples

- "Create a flowchart for user registration process"
- "Draw a sequence diagram for API authentication"
- "Generate a class diagram for an e-commerce system"
- "Create a Gantt chart for a 3-month project"
- "Draw a mind map for product features"
