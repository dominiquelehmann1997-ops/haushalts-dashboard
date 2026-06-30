# syncCalendarAction()

> God node · 9 connections · [C:\Users\ThinkPad\Documents\Claude\Dashboard\web\src\app\actions\calendar.ts](file:///C:/Users/ThinkPad/Documents/Claude/Dashboard/web/src/app/actions/calendar.ts#L16)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as syncCalendarAction()
    participant P1 as revalidateDashboard()
    participant P2 as generatePlanAction()
    participant P3 as generateWeekPlan()
    participant P4 as getActivePhase()
    participant P5 as sendToAdults()
    participant P6 as getDomeShiftsForWeek()
    participant P7 as deriveDayConstraints()
    participant P8 as ingestVaultIfConfigured()
    participant P9 as approveDraftAction()
    participant P10 as syncIngredientsToShopping()
    participant P11 as getFreshShoppingState()
    participant P12 as pushRecipeBatch()
    participant P13 as approveDraft()
    participant P14 as rerollDraftDayAction()
    participant P15 as addManualEntryAction()
    participant P16 as setDraftDayRecipeAction()
    participant P17 as discardDraftAction()
    participant P18 as pushFreshBatchAction()
    participant P19 as createNoteAction()
    participant P20 as updateNoteAction()
    participant P21 as deleteNoteAction()
    participant P22 as togglePinNoteAction()
    participant P23 as setPhaseAction()
    participant P24 as ingestVaultAction()
    participant P25 as toggleShoppingAction()
    participant P26 as deleteShoppingAction()
    participant P27 as clearShoppingAction()
    participant P28 as toggleFreshnessAction()
    participant P29 as toggleTaskAction()
    participant P30 as deferTaskAction()
    participant P31 as failTaskAction()
    participant P32 as completeTaskByAction()
    participant P33 as addTaskAction()
    participant P34 as dayBounds()
    participant P35 as planDueTasks()
    participant P36 as syncCalendar()
    participant P37 as getBusyWindows()
    participant P38 as rollOverdueRoutines()
    participant P39 as getForecast()
    participant P40 as configuredCalendars()
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
    P1->>+ P9: calls
    P9-->>- P1: return
    P9->>+ P1: calls
    P1-->>- P9: return
    P9->>+ P10: calls
    P10-->>- P9: return
    P9->>+ P11: calls
    P11-->>- P9: return
    P9->>+ P12: calls
    P12-->>- P9: return
    P9->>+ P13: calls
    P13-->>- P9: return
    P1->>+ P14: calls
    P14-->>- P1: return
    P1->>+ P15: calls
    P15-->>- P1: return
    P1->>+ P16: calls
    P16-->>- P1: return
    P1->>+ P17: calls
    P17-->>- P1: return
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
    P0->>+ P34: calls
    P34-->>- P0: return
    P0->>+ P35: calls
    P35-->>- P0: return
    P0->>+ P36: calls
    P36-->>- P0: return
    P0->>+ P37: calls
    P37-->>- P0: return
    P0->>+ P38: calls
    P38-->>- P0: return
    P0->>+ P39: calls
    P39-->>- P0: return
    P0->>+ P40: calls
    P40-->>- P0: return
```

## Connections by Relation

### calls
- [[revalidateDashboard()]] `INFERRED`
- [[dayBounds()]] `INFERRED`
- [[planDueTasks()]] `INFERRED`
- [[syncCalendar()]] `INFERRED`
- [[getBusyWindows()]] `INFERRED`
- [[rollOverdueRoutines()]] `INFERRED`
- [[getForecast()]] `INFERRED`
- [[configuredCalendars()]] `INFERRED`

### contains
- [[calendar.ts]] `EXTRACTED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*