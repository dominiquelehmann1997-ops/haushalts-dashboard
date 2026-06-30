# Architectural Compass - C:\Users\ThinkPad\Documents\Claude\Dashboard (2026-06-30)

> [!NOTE]
> This is a token-optimized summary. For deep logic, see GRAPH_REPORT.md.

## Core Abstractions (God Nodes)
1. `map` (37 edges)
2. `revalidateDashboard()` (24 edges)
3. `GET()` (12 edges)
4. `dayBounds()` (12 edges)
5. `rerollDraftDay()` (11 edges)
6. `planDueTasks()` (11 edges)
7. `currentWeekBounds()` (10 edges)
8. `generateWeekPlan()` (10 edges)
9. `syncIngredientsToShopping()` (10 edges)
10. `syncCalendarAction()` (9 edges)

## System Layers
- **L0: Global/Entry**: 
- **L1: Strategic/Core**: 
- **L2: Implementation**: `Person`, `Task`, `Project`, `CalendarEvent`, `AccountEntry`, `PhaseSetting`, `Recipe`, `Ingredient` (+6)
- **L3: Utility**: 