---
name: plantuml-dsl
description: PlantUML DSL 语法参考。当用户使用 /plantuml 命令或提供 PlantUML 代码时加载。支持类图、序列图、活动图、状态图、用例图、思维导图、ER图、部署图、C4架构图。
engine: drawio
---

# PlantUML DSL Reference

PlantUML is a text-based DSL for creating UML diagrams. Use `convert_plantuml_to_drawio` tool to convert PlantUML code to Draw.io XML.

## Supported Diagram Types

- Class diagrams
- Sequence diagrams
- Activity diagrams
- State diagrams
- Use case diagrams
- Mind maps
- Entity-Relationship (ER) diagrams
- Deployment diagrams
- C4 architecture diagrams

## Basic Syntax

### Class Diagram
```plantuml
@startuml
class User {
  +id: int
  +name: string
  +email: string
  +login()
  +logout()
}

class Order {
  +orderId: int
  +total: decimal
  +createOrder()
  +cancelOrder()
}

User "1" -- "*" Order : places
@enduml
```

### Sequence Diagram
```plantuml
@startuml
actor User
participant "Web App" as App
participant "API Server" as API
database "Database" as DB

User -> App: Login request
App -> API: Authenticate
API -> DB: Query user
DB --> API: User data
API --> App: Auth token
App --> User: Login success
@enduml
```

### Activity Diagram
```plantuml
@startuml
start
:Receive order;
if (In stock?) then (yes)
  :Process order;
  :Ship item;
else (no)
  :Notify customer;
  :Backorder;
endif
:Send confirmation;
stop
@enduml
```

### State Diagram
```plantuml
@startuml
[*] --> Draft
Draft --> Submitted : submit
Submitted --> Approved : approve
Submitted --> Rejected : reject
Approved --> [*]
Rejected --> Draft : revise
@enduml
```

### Use Case Diagram
```plantuml
@startuml
left to right direction
actor Customer
actor Admin

rectangle "E-commerce System" {
  Customer --> (Browse Products)
  Customer --> (Add to Cart)
  Customer --> (Checkout)
  Admin --> (Manage Products)
  Admin --> (Process Orders)
}
@enduml
```

### Mind Map
```plantuml
@startmindmap
* Project Planning
** Requirements
*** Functional
*** Non-functional
** Design
*** Architecture
*** UI/UX
** Development
*** Frontend
*** Backend
** Testing
*** Unit tests
*** Integration tests
@endmindmap
```

### ER Diagram
```plantuml
@startuml
entity User {
  * user_id : int <<PK>>
  --
  * name : varchar
  * email : varchar
  created_at : datetime
}

entity Order {
  * order_id : int <<PK>>
  --
  * user_id : int <<FK>>
  * total : decimal
  * status : varchar
}

User ||--o{ Order : places
@enduml
```

### C4 Context Diagram
```plantuml
@startuml
!include <C4/C4_Context>

Person(user, "User", "A customer of the system")
System(system, "E-commerce System", "Allows users to browse and purchase products")
System_Ext(payment, "Payment Gateway", "Handles payment processing")
System_Ext(email, "Email Service", "Sends notifications")

Rel(user, system, "Uses")
Rel(system, payment, "Processes payments")
Rel(system, email, "Sends emails")
@enduml
```

## Styling

### Colors and Themes
```plantuml
@startuml
skinparam backgroundColor #EEEBDC
skinparam handwritten true

skinparam class {
  BackgroundColor PaleGreen
  BorderColor DarkGreen
  ArrowColor SeaGreen
}
@enduml
```

### Notes
```plantuml
@startuml
class User
note right of User : This is a note
note "General note" as N1
@enduml
```

## Usage Tips

1. **Always wrap code** in `@startuml` / `@enduml` (or `@startmindmap` / `@endmindmap` for mind maps)
2. **Use stereotypes** `<<stereotype>>` for classification
3. **Relationship symbols:**
   - `--` association
   - `-->` directed association
   - `<|--` inheritance
   - `*--` composition
   - `o--` aggregation
4. **Visibility modifiers:**
   - `+` public
   - `-` private
   - `#` protected
   - `~` package

## Examples

- "Create a class diagram for a blog system with User, Post, and Comment"
- "Draw a sequence diagram for user authentication flow"
- "Generate an activity diagram for order processing"
- "Create a C4 context diagram for a microservices architecture"
