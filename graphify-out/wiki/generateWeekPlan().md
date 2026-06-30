# generateWeekPlan()

> God node · 10 connections · [C:\Users\ThinkPad\Documents\Claude\Dashboard\web\src\lib\services\mealPlanner.ts](file:///C:/Users/ThinkPad/Documents/Claude/Dashboard/web/src/lib/services/mealPlanner.ts#L78)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as generateWeekPlan()
    participant P1 as map
    participant P2 as syncIngredientsToShopping()
    participant P3 as GET()
    participant P4 as currentWeekBounds()
    participant P5 as combineAmounts()
    participant P6 as approveDraftAction()
    participant P7 as getFreshnessOverrides()
    participant P8 as resolveFreshness()
    participant P9 as main()
    participant P10 as join
    participant P11 as getShoppingItems()
    participant P12 as reduce()
    participant P13 as withUnit()
    participant P14 as formatNumber()
    participant P15 as getFreshShoppingState()
    participant P16 as sendToAdults()
    participant P17 as mapCurrent()
    participant P18 as getNotes()
    participant P19 as configuredCalendars()
    participant P20 as weightedPick()
    participant P21 as pushRecipeBatch()
    participant P22 as main()
    participant P23 as parseEventTime()
    participant P24 as coveredMs()
    participant P25 as fromLocalDateKey()
    participant P26 as getTodaysEvents()
    participant P27 as replaceWindowEvents()
    participant P28 as getWeekMealPlan()
    participant P29 as getDraftMealPlan()
    participant P30 as getTasksByPerson()
    participant P31 as getTasksForDay()
    participant P32 as buildChoreTasks()
    participant P33 as deriveDayConstraints()
    participant P34 as handleCopy()
    participant P35 as handleCopy()
    participant P36 as handleCopy()
    participant P37 as toBringItems()
    participant P38 as mapForecast()
    participant P39 as toMinutes()
    participant P40 as listOpenTasks()
    participant P41 as constraintsForWeek()
    participant P42 as VaultIngestControl()
    participant P43 as MobileNavBar()
    participant P44 as listRecipes()
    participant P45 as planDueTasks()
    participant P46 as generatePlanAction()
    participant P47 as weekBoundsOf()
    participant P48 as recentRecipeUse()
    participant P49 as candidatesFor()
    participant P50 as add()
    P0->>+ P1: calls
    P1-->>- P0: return
    P1->>+ P0: calls
    P0-->>- P1: return
    P1->>+ P2: calls
    P2-->>- P1: return
    P2->>+ P1: calls
    P1-->>- P2: return
    P2->>+ P3: calls
    P3-->>- P2: return
    P2->>+ P4: calls
    P4-->>- P2: return
    P2->>+ P5: calls
    P5-->>- P2: return
    P2->>+ P6: calls
    P6-->>- P2: return
    P2->>+ P7: calls
    P7-->>- P2: return
    P2->>+ P8: calls
    P8-->>- P2: return
    P2->>+ P9: calls
    P9-->>- P2: return
    P1->>+ P5: calls
    P5-->>- P1: return
    P5->>+ P1: calls
    P1-->>- P5: return
    P5->>+ P3: calls
    P3-->>- P5: return
    P5->>+ P2: calls
    P2-->>- P5: return
    P5->>+ P10: calls
    P10-->>- P5: return
    P5->>+ P11: semantically_similar_to
    P11-->>- P5: return
    P5->>+ P12: calls
    P12-->>- P5: return
    P5->>+ P13: calls
    P13-->>- P5: return
    P5->>+ P14: calls
    P14-->>- P5: return
    P1->>+ P15: calls
    P15-->>- P1: return
    P1->>+ P16: calls
    P16-->>- P1: return
    P1->>+ P17: calls
    P17-->>- P1: return
    P1->>+ P11: calls
    P11-->>- P1: return
    P1->>+ P7: calls
    P7-->>- P1: return
    P1->>+ P18: calls
    P18-->>- P1: return
    P1->>+ P19: calls
    P19-->>- P1: return
    P1->>+ P20: calls
    P20-->>- P1: return
    P1->>+ P21: calls
    P21-->>- P1: return
    P1->>+ P22: calls
    P22-->>- P1: return
    P1->>+ P12: calls
    P12-->>- P1: return
    P1->>+ P23: calls
    P23-->>- P1: return
    P1->>+ P24: calls
    P24-->>- P1: return
    P1->>+ P25: calls
    P25-->>- P1: return
    P1->>+ P26: calls
    P26-->>- P1: return
    P1->>+ P27: calls
    P27-->>- P1: return
    P1->>+ P28: calls
    P28-->>- P1: return
    P1->>+ P29: calls
    P29-->>- P1: return
    P1->>+ P30: calls
    P30-->>- P1: return
    P1->>+ P31: calls
    P31-->>- P1: return
    P1->>+ P32: calls
    P32-->>- P1: return
    P1->>+ P33: calls
    P33-->>- P1: return
    P1->>+ P34: calls
    P34-->>- P1: return
    P1->>+ P35: calls
    P35-->>- P1: return
    P1->>+ P36: calls
    P36-->>- P1: return
    P1->>+ P37: calls
    P37-->>- P1: return
    P1->>+ P38: calls
    P38-->>- P1: return
    P1->>+ P39: calls
    P39-->>- P1: return
    P1->>+ P40: calls
    P40-->>- P1: return
    P1->>+ P41: calls
    P41-->>- P1: return
    P1->>+ P42: calls
    P42-->>- P1: return
    P1->>+ P43: calls
    P43-->>- P1: return
    P1->>+ P44: calls
    P44-->>- P1: return
    P0->>+ P45: semantically_similar_to
    P45-->>- P0: return
    P0->>+ P46: calls
    P46-->>- P0: return
    P0->>+ P47: calls
    P47-->>- P0: return
    P0->>+ P20: calls
    P20-->>- P0: return
    P0->>+ P48: calls
    P48-->>- P0: return
    P0->>+ P49: calls
    P49-->>- P0: return
    P0->>+ P50: calls
    P50-->>- P0: return
```

## Connections by Relation

### calls
- [[map]] `INFERRED`
- [[generatePlanAction()]] `INFERRED`
- [[weekBoundsOf()]] `INFERRED`
- [[weightedPick()]] `INFERRED`
- [[recentRecipeUse()]] `INFERRED`
- [[candidatesFor()]] `EXTRACTED`
- [[add()]] `INFERRED`

### conceptually_related_to
- [[rerollDraftDay()]] `INFERRED`

### contains
- [[mealPlanner.ts]] `EXTRACTED`

### semantically_similar_to
- [[planDueTasks()]] `INFERRED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*