# planDueTasks()

> God node · 11 connections · [C:\Users\ThinkPad\Documents\Claude\Dashboard\web\src\lib\services\planning.ts](file:///C:/Users/ThinkPad/Documents/Claude/Dashboard/web/src/lib/services/planning.ts#L113)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as planDueTasks()
    participant P1 as dayBounds()
    participant P2 as syncCalendarAction()
    participant P3 as revalidateDashboard()
    participant P4 as syncCalendar()
    participant P5 as getBusyWindows()
    participant P6 as rollOverdueRoutines()
    participant P7 as getForecast()
    participant P8 as configuredCalendars()
    participant P9 as main()
    participant P10 as count
    participant P11 as getTodaysEvents()
    participant P12 as getTasksByPerson()
    participant P13 as getTasksForDay()
    participant P14 as findDraftEntryForDay()
    participant P15 as activeDayWindow()
    participant P16 as rolloverOpenTasks()
    participant P17 as allDayToday()
    participant P18 as generateWeekPlan()
    participant P19 as planTask()
    participant P20 as getWeeklyBalances()
    participant P21 as loadPhaseConfig()
    participant P22 as toEngineTask()
    participant P23 as assignTask()
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
    P2->>+ P0: calls
    P0-->>- P2: return
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
    P9->>+ P0: calls
    P0-->>- P9: return
    P9->>+ P5: calls
    P5-->>- P9: return
    P9->>+ P6: calls
    P6-->>- P9: return
    P9->>+ P7: calls
    P7-->>- P9: return
    P9->>+ P10: calls
    P10-->>- P9: return
    P1->>+ P6: calls
    P6-->>- P1: return
    P1->>+ P11: calls
    P11-->>- P1: return
    P1->>+ P12: calls
    P12-->>- P1: return
    P1->>+ P13: calls
    P13-->>- P1: return
    P1->>+ P14: calls
    P14-->>- P1: return
    P1->>+ P15: semantically_similar_to
    P15-->>- P1: return
    P1->>+ P16: calls
    P16-->>- P1: return
    P1->>+ P17: calls
    P17-->>- P1: return
    P0->>+ P18: semantically_similar_to
    P18-->>- P0: return
    P0->>+ P2: calls
    P2-->>- P0: return
    P0->>+ P9: calls
    P9-->>- P0: return
    P0->>+ P19: calls
    P19-->>- P0: return
    P0->>+ P20: calls
    P20-->>- P0: return
    P0->>+ P15: calls
    P15-->>- P0: return
    P0->>+ P21: calls
    P21-->>- P0: return
    P0->>+ P22: calls
    P22-->>- P0: return
    P0->>+ P23: calls
    P23-->>- P0: return
```

## Connections by Relation

### calls
- [[dayBounds()]] `INFERRED`
- [[syncCalendarAction()]] `INFERRED`
- [[main()]] `INFERRED`
- [[planTask()]] `INFERRED`
- [[getWeeklyBalances()]] `INFERRED`
- [[activeDayWindow()]] `INFERRED`
- [[loadPhaseConfig()]] `EXTRACTED`
- [[toEngineTask()]] `EXTRACTED`
- [[assignTask()]] `INFERRED`

### contains
- [[planning.ts]] `EXTRACTED`

### semantically_similar_to
- [[generateWeekPlan()]] `INFERRED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*