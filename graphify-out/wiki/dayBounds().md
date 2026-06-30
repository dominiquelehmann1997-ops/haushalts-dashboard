# dayBounds()

> God node · 12 connections · [C:\Users\ThinkPad\Documents\Claude\Dashboard\web\src\lib\dates.ts](file:///C:/Users/ThinkPad/Documents/Claude/Dashboard/web/src/lib/dates.ts#L11)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as dayBounds()
    participant P1 as planDueTasks()
    participant P2 as generateWeekPlan()
    participant P3 as map
    participant P4 as generatePlanAction()
    participant P5 as weekBoundsOf()
    participant P6 as weightedPick()
    participant P7 as recentRecipeUse()
    participant P8 as candidatesFor()
    participant P9 as add()
    participant P10 as syncCalendarAction()
    participant P11 as revalidateDashboard()
    participant P12 as syncCalendar()
    participant P13 as getBusyWindows()
    participant P14 as rollOverdueRoutines()
    participant P15 as getForecast()
    participant P16 as configuredCalendars()
    participant P17 as main()
    participant P18 as planTask()
    participant P19 as getWeeklyBalances()
    participant P20 as activeDayWindow()
    participant P21 as loadPhaseConfig()
    participant P22 as toEngineTask()
    participant P23 as assignTask()
    participant P24 as getTodaysEvents()
    participant P25 as getTasksByPerson()
    participant P26 as getTasksForDay()
    participant P27 as findDraftEntryForDay()
    participant P28 as rolloverOpenTasks()
    participant P29 as allDayToday()
    P0->>+ P1: calls
    P1-->>- P0: return
    P1->>+ P0: calls
    P0-->>- P1: return
    P1->>+ P2: semantically_similar_to
    P2-->>- P1: return
    P2->>+ P3: calls
    P3-->>- P2: return
    P2->>+ P1: semantically_similar_to
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
    P1->>+ P10: calls
    P10-->>- P1: return
    P10->>+ P11: calls
    P11-->>- P10: return
    P10->>+ P0: calls
    P0-->>- P10: return
    P10->>+ P1: calls
    P1-->>- P10: return
    P10->>+ P12: calls
    P12-->>- P10: return
    P10->>+ P13: calls
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
    P1->>+ P20: calls
    P20-->>- P1: return
    P1->>+ P21: calls
    P21-->>- P1: return
    P1->>+ P22: calls
    P22-->>- P1: return
    P1->>+ P23: calls
    P23-->>- P1: return
    P0->>+ P10: calls
    P10-->>- P0: return
    P0->>+ P17: calls
    P17-->>- P0: return
    P0->>+ P14: calls
    P14-->>- P0: return
    P0->>+ P24: calls
    P24-->>- P0: return
    P0->>+ P25: calls
    P25-->>- P0: return
    P0->>+ P26: calls
    P26-->>- P0: return
    P0->>+ P27: calls
    P27-->>- P0: return
    P0->>+ P20: semantically_similar_to
    P20-->>- P0: return
    P0->>+ P28: calls
    P28-->>- P0: return
    P0->>+ P29: calls
    P29-->>- P0: return
```

## Connections by Relation

### calls
- [[planDueTasks()]] `INFERRED`
- [[syncCalendarAction()]] `INFERRED`
- [[main()]] `INFERRED`
- [[rollOverdueRoutines()]] `INFERRED`
- [[getTodaysEvents()]] `INFERRED`
- [[getTasksByPerson()]] `INFERRED`
- [[getTasksForDay()]] `INFERRED`
- [[findDraftEntryForDay()]] `INFERRED`
- [[rolloverOpenTasks()]] `INFERRED`
- [[allDayToday()]] `INFERRED`

### contains
- [[dates.ts]] `EXTRACTED`

### semantically_similar_to
- [[activeDayWindow()]] `INFERRED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*