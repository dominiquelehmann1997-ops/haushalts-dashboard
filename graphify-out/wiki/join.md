# join

> God node · 17 connections · [C:\Users\ThinkPad\Documents\Claude\Dashboard\web\src\generated\prisma\internal\prismaNamespace.ts](file:///C:/Users/ThinkPad/Documents/Claude/Dashboard/web/src/generated/prisma/internal/prismaNamespace.ts#L52)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as join
    participant P1 as GET()
    participant P2 as exportRecipes()
    participant P3 as cleanup()
    participant P4 as add()
    participant P5 as main()
    participant P6 as assignExportFileNames()
    participant P7 as recipeToMarkdown()
    participant P8 as message()
    participant P9 as listAllRecipes()
    participant P10 as seedDatabase()
    participant P11 as all
    participant P12 as count
    participant P13 as entries
    participant P14 as addDays()
    participant P15 as main()
    participant P16 as resetDatabase()
    participant P17 as combineAmounts()
    participant P18 as notFound()
    participant P19 as runSync()
    participant P20 as checkImportToken()
    participant P21 as rollOverdueRoutines()
    participant P22 as collectTags()
    participant P23 as recipeImageDir()
    participant P24 as classifyShift()
    participant P25 as listRoutineTemplates()
    participant P26 as getAuthUrl()
    participant P27 as exchangeCode()
    participant P28 as isSafeImageFile()
    participant P29 as contentTypeForImage()
    participant P30 as extractRecipeFromText()
    participant P31 as downloadRecipeImage()
    participant P32 as searchHaystack()
    participant P33 as handleCopy()
    participant P34 as draftFromRecipe()
    participant P35 as buildIdeasPrompt()
    participant P36 as buildBody()
    participant P37 as isVegetarian()
    participant P38 as ingredientLabel()
    participant P39 as handleCopy()
    participant P40 as makeDir()
    P0->>+ P1: calls
    P1-->>- P0: return
    P1->>+ P0: calls
    P0-->>- P1: return
    P1->>+ P2: calls
    P2-->>- P1: return
    P2->>+ P1: calls
    P1-->>- P2: return
    P2->>+ P0: calls
    P0-->>- P2: return
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
    P1->>+ P10: calls
    P10-->>- P1: return
    P10->>+ P1: calls
    P1-->>- P10: return
    P10->>+ P11: calls
    P11-->>- P10: return
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
    P0->>+ P2: calls
    P2-->>- P0: return
    P0->>+ P30: calls
    P30-->>- P0: return
    P0->>+ P31: calls
    P31-->>- P0: return
    P0->>+ P17: calls
    P17-->>- P0: return
    P0->>+ P3: calls
    P3-->>- P0: return
    P0->>+ P32: calls
    P32-->>- P0: return
    P0->>+ P5: calls
    P5-->>- P0: return
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
    P0->>+ P40: calls
    P40-->>- P0: return
```

## Connections by Relation

### calls
- [[GET()]] `INFERRED`
- [[exportRecipes()]] `INFERRED`
- [[extractRecipeFromText()]] `INFERRED`
- [[downloadRecipeImage()]] `INFERRED`
- [[combineAmounts()]] `INFERRED`
- [[cleanup()]] `INFERRED`
- [[searchHaystack()]] `INFERRED`
- [[main()]] `INFERRED`
- [[handleCopy()]] `INFERRED`
- [[draftFromRecipe()]] `INFERRED`
- [[buildIdeasPrompt()]] `INFERRED`
- [[buildBody()]] `INFERRED`
- [[isVegetarian()]] `INFERRED`
- [[ingredientLabel()]] `INFERRED`
- [[handleCopy()]] `INFERRED`
- [[makeDir()]] `INFERRED`

### contains
- [[prismaNamespace.ts]] `EXTRACTED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*