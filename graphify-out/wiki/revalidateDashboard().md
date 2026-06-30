# revalidateDashboard()

> God node · 25 connections · [C:\Users\ThinkPad\Documents\Claude\Dashboard\web\src\lib\revalidate.ts](file:///C:/Users/ThinkPad/Documents/Claude/Dashboard/web/src/lib/revalidate.ts#L17)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as revalidateDashboard()
    participant P1 as syncCalendarAction()
    participant P2 as dayBounds()
    participant P3 as planDueTasks()
    participant P4 as main()
    participant P5 as rollOverdueRoutines()
    participant P6 as getTodaysEvents()
    participant P7 as getTasksByPerson()
    participant P8 as getTasksForDay()
    participant P9 as findDraftEntryForDay()
    participant P10 as activeDayWindow()
    participant P11 as rolloverOpenTasks()
    participant P12 as allDayToday()
    participant P13 as syncCalendar()
    participant P14 as getBusyWindows()
    participant P15 as getForecast()
    participant P16 as configuredCalendars()
    participant P17 as generatePlanAction()
    participant P18 as approveDraftAction()
    participant P19 as rerollDraftDayAction()
    participant P20 as addManualEntryAction()
    participant P21 as setDraftDayRecipeAction()
    participant P22 as discardDraftAction()
    participant P23 as pushFreshBatchAction()
    participant P24 as createNoteAction()
    participant P25 as updateNoteAction()
    participant P26 as deleteNoteAction()
    participant P27 as togglePinNoteAction()
    participant P28 as setPhaseAction()
    participant P29 as ingestVaultAction()
    participant P30 as toggleShoppingAction()
    participant P31 as deleteShoppingAction()
    participant P32 as clearShoppingAction()
    participant P33 as toggleFreshnessAction()
    participant P34 as toggleTaskAction()
    participant P35 as deferTaskAction()
    participant P36 as failTaskAction()
    participant P37 as completeTaskByAction()
    participant P38 as completeTaskByBothAction()
    participant P39 as addTaskAction()
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
    P2->>+ P10: semantically_similar_to
    P10-->>- P2: return
    P2->>+ P11: calls
    P11-->>- P2: return
    P2->>+ P12: calls
    P12-->>- P2: return
    P1->>+ P3: calls
    P3-->>- P1: return
    P1->>+ P13: calls
    P13-->>- P1: return
    P1->>+ P14: calls
    P14-->>- P1: return
    P1->>+ P5: calls
    P5-->>- P1: return
    P1->>+ P15: calls
    P15-->>- P1: return
    P1->>+ P16: calls
    P16-->>- P1: return
    P0->>+ P17: calls
    P17-->>- P0: return
    P0->>+ P18: calls
    P18-->>- P0: return
    P0->>+ P19: calls
    P19-->>- P0: return
    P0->>+ P20: calls
    P20-->>- P0: return
    P0->>+ P21: calls
    P21-->>- P0: return
    P0->>+ P22: calls
    P22-->>- P0: return
    P0->>+ P23: calls
    P23-->>- P0: return
    P0->>+ P24: calls
    P24-->>- P0: return
    P0->>+ P25: calls
    P25-->>- P0: return
    P0->>+ P26: calls
    P26-->>- P0: return
    P0->>+ P27: calls
    P27-->>- P0: return
    P0->>+ P28: calls
    P28-->>- P0: return
    P0->>+ P29: calls
    P29-->>- P0: return
    P0->>+ P30: calls
    P30-->>- P0: return
    P0->>+ P31: calls
    P31-->>- P0: return
    P0->>+ P32: calls
    P32-->>- P0: return
    P0->>+ P33: calls
    P33-->>- P0: return
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
```

## Connections by Relation

### calls
- [[syncCalendarAction()]] `INFERRED`
- [[generatePlanAction()]] `INFERRED`
- [[approveDraftAction()]] `INFERRED`
- [[rerollDraftDayAction()]] `INFERRED`
- [[addManualEntryAction()]] `INFERRED`
- [[setDraftDayRecipeAction()]] `INFERRED`
- [[discardDraftAction()]] `INFERRED`
- [[pushFreshBatchAction()]] `INFERRED`
- [[createNoteAction()]] `INFERRED`
- [[updateNoteAction()]] `INFERRED`
- [[deleteNoteAction()]] `INFERRED`
- [[togglePinNoteAction()]] `INFERRED`
- [[setPhaseAction()]] `INFERRED`
- [[ingestVaultAction()]] `INFERRED`
- [[toggleShoppingAction()]] `INFERRED`
- [[deleteShoppingAction()]] `INFERRED`
- [[clearShoppingAction()]] `INFERRED`
- [[toggleFreshnessAction()]] `INFERRED`
- [[toggleTaskAction()]] `INFERRED`
- [[deferTaskAction()]] `INFERRED`

### contains
- [[revalidate.ts]] `EXTRACTED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*