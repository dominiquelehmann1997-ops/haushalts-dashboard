# syncIngredientsToShopping()

> God node · 10 connections · [C:\Users\ThinkPad\Documents\Claude\Dashboard\web\src\lib\services\shoppingSync.ts](file:///C:/Users/ThinkPad/Documents/Claude/Dashboard/web/src/lib/services/shoppingSync.ts#L29)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as syncIngredientsToShopping()
    participant P1 as map
    participant P2 as generateWeekPlan()
    participant P3 as planDueTasks()
    participant P4 as generatePlanAction()
    participant P5 as weekBoundsOf()
    participant P6 as weightedPick()
    participant P7 as recentRecipeUse()
    participant P8 as candidatesFor()
    participant P9 as add()
    participant P10 as combineAmounts()
    participant P11 as GET()
    participant P12 as join
    participant P13 as getShoppingItems()
    participant P14 as reduce()
    participant P15 as withUnit()
    participant P16 as formatNumber()
    participant P17 as getFreshShoppingState()
    participant P18 as sendToAdults()
    participant P19 as mapCurrent()
    participant P20 as getFreshnessOverrides()
    participant P21 as getNotes()
    participant P22 as configuredCalendars()
    participant P23 as pushRecipeBatch()
    participant P24 as main()
    participant P25 as parseEventTime()
    participant P26 as coveredMs()
    participant P27 as fromLocalDateKey()
    participant P28 as getTodaysEvents()
    participant P29 as replaceWindowEvents()
    participant P30 as getWeekMealPlan()
    participant P31 as getDraftMealPlan()
    participant P32 as getTasksByPerson()
    participant P33 as getTasksForDay()
    participant P34 as buildChoreTasks()
    participant P35 as deriveDayConstraints()
    participant P36 as handleCopy()
    participant P37 as handleCopy()
    participant P38 as handleCopy()
    participant P39 as toBringItems()
    participant P40 as mapForecast()
    participant P41 as toMinutes()
    participant P42 as listOpenTasks()
    participant P43 as constraintsForWeek()
    participant P44 as VaultIngestControl()
    participant P45 as MobileNavBar()
    participant P46 as listRecipes()
    participant P47 as currentWeekBounds()
    participant P48 as approveDraftAction()
    participant P49 as resolveFreshness()
    participant P50 as main()
    P0->>+ P1: calls
    P1-->>- P0: return
    P1->>+ P2: calls
    P2-->>- P1: return
    P2->>+ P1: calls
    P1-->>- P2: return
    P2->>+ P3: semantically_similar_to
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
    P1->>+ P0: calls
    P0-->>- P1: return
    P1->>+ P10: calls
    P10-->>- P1: return
    P10->>+ P1: calls
    P1-->>- P10: return
    P10->>+ P11: calls
    P11-->>- P10: return
    P10->>+ P0: calls
    P0-->>- P10: return
    P10->>+ P12: calls
    P12-->>- P10: return
    P10->>+ P13: semantically_similar_to
    P13-->>- P10: return
    P10->>+ P14: calls
    P14-->>- P10: return
    P10->>+ P15: calls
    P15-->>- P10: return
    P10->>+ P16: calls
    P16-->>- P10: return
    P1->>+ P17: calls
    P17-->>- P1: return
    P1->>+ P18: calls
    P18-->>- P1: return
    P1->>+ P19: calls
    P19-->>- P1: return
    P1->>+ P13: calls
    P13-->>- P1: return
    P1->>+ P20: calls
    P20-->>- P1: return
    P1->>+ P21: calls
    P21-->>- P1: return
    P1->>+ P22: calls
    P22-->>- P1: return
    P1->>+ P6: calls
    P6-->>- P1: return
    P1->>+ P23: calls
    P23-->>- P1: return
    P1->>+ P24: calls
    P24-->>- P1: return
    P1->>+ P14: calls
    P14-->>- P1: return
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
    P1->>+ P45: calls
    P45-->>- P1: return
    P1->>+ P46: calls
    P46-->>- P1: return
    P0->>+ P11: calls
    P11-->>- P0: return
    P0->>+ P47: calls
    P47-->>- P0: return
    P0->>+ P10: calls
    P10-->>- P0: return
    P0->>+ P48: calls
    P48-->>- P0: return
    P0->>+ P20: calls
    P20-->>- P0: return
    P0->>+ P49: calls
    P49-->>- P0: return
    P0->>+ P50: calls
    P50-->>- P0: return
```

## Connections by Relation

### calls
- [[map]] `INFERRED`
- [[GET()]] `INFERRED`
- [[currentWeekBounds()]] `INFERRED`
- [[combineAmounts()]] `INFERRED`
- [[approveDraftAction()]] `INFERRED`
- [[getFreshnessOverrides()]] `INFERRED`
- [[resolveFreshness()]] `INFERRED`
- [[main()]] `INFERRED`

### contains
- [[shoppingSync.ts]] `EXTRACTED`

### shares_data_with
- [[pushRecipeBatch()]] `INFERRED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*