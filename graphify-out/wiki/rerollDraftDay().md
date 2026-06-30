# rerollDraftDay()

> God node · 11 connections · [C:\Users\ThinkPad\Documents\Claude\Dashboard\web\src\lib\services\mealDraft.ts](file:///C:/Users/ThinkPad/Documents/Claude/Dashboard/web/src/lib/services/mealDraft.ts#L67)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as rerollDraftDay()
    participant P1 as weekBoundsOf()
    participant P2 as currentWeekBounds()
    participant P3 as syncIngredientsToShopping()
    participant P4 as getFreshShoppingState()
    participant P5 as getWeeklyBalances()
    participant P6 as getWeekMealPlan()
    participant P7 as getDraftMealPlan()
    participant P8 as weekCounts()
    participant P9 as constraintsForWeek()
    participant P10 as draftMondayEntry()
    participant P11 as generateWeekPlan()
    participant P12 as map
    participant P13 as planDueTasks()
    participant P14 as generatePlanAction()
    participant P15 as weightedPick()
    participant P16 as recentRecipeUse()
    participant P17 as candidatesFor()
    participant P18 as add()
    participant P19 as mondayOf()
    participant P20 as approveDraft()
    participant P21 as discardDraft()
    participant P22 as addDays()
    participant P23 as findDraftEntryForDay()
    participant P24 as rerollDraftDayAction()
    participant P25 as constraintFromEntry()
    P0->>+ P1: calls
    P1-->>- P0: return
    P1->>+ P0: calls
    P0-->>- P1: return
    P1->>+ P2: calls
    P2-->>- P1: return
    P2->>+ P3: calls
    P3-->>- P2: return
    P2->>+ P1: calls
    P1-->>- P2: return
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
    P2->>+ P10: calls
    P10-->>- P2: return
    P1->>+ P11: calls
    P11-->>- P1: return
    P11->>+ P12: calls
    P12-->>- P11: return
    P11->>+ P13: semantically_similar_to
    P13-->>- P11: return
    P11->>+ P14: calls
    P14-->>- P11: return
    P11->>+ P1: calls
    P1-->>- P11: return
    P11->>+ P15: calls
    P15-->>- P11: return
    P11->>+ P16: calls
    P16-->>- P11: return
    P11->>+ P17: calls
    P17-->>- P11: return
    P11->>+ P18: calls
    P18-->>- P11: return
    P1->>+ P19: calls
    P19-->>- P1: return
    P1->>+ P20: calls
    P20-->>- P1: return
    P1->>+ P21: calls
    P21-->>- P1: return
    P1->>+ P22: calls
    P22-->>- P1: return
    P0->>+ P15: calls
    P15-->>- P0: return
    P0->>+ P23: calls
    P23-->>- P0: return
    P0->>+ P24: calls
    P24-->>- P0: return
    P0->>+ P16: calls
    P16-->>- P0: return
    P0->>+ P17: calls
    P17-->>- P0: return
    P0->>+ P25: calls
    P25-->>- P0: return
```

## Connections by Relation

### calls
- [[weekBoundsOf()]] `INFERRED`
- [[weightedPick()]] `INFERRED`
- [[findDraftEntryForDay()]] `EXTRACTED`
- [[rerollDraftDayAction()]] `INFERRED`
- [[recentRecipeUse()]] `INFERRED`
- [[candidatesFor()]] `INFERRED`
- [[constraintFromEntry()]] `INFERRED`

### conceptually_related_to
- [[generateWeekPlan()]] `INFERRED`
- [[setDraftDayRecipe()]] `INFERRED`
- [[recipeWeight()]] `INFERRED`

### contains
- [[mealDraft.ts]] `EXTRACTED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*