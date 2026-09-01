# GET()

> God node · 20 connections · [C:\Users\ThinkPad\Documents\Claude\Dashboard\web\src\app\api\sync\calendar\route.ts](file:///C:/Users/ThinkPad/Documents/Claude/Dashboard/web/src/app/api/sync/calendar/route.ts#L31)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as GET()
    participant P1 as join
    participant P2 as exportRecipes()
    participant P3 as cleanup()
    participant P4 as add()
    participant P5 as main()
    participant P6 as assignExportFileNames()
    participant P7 as recipeToMarkdown()
    participant P8 as message()
    participant P9 as listAllRecipes()
    participant P10 as extractRecipeFromText()
    participant P11 as POST()
    participant P12 as parseExtractionResponse()
    participant P13 as toImportedFromExtraction()
    participant P14 as runClaude()
    participant P15 as buildExtractionPrompt()
    participant P16 as problemsOf()
    participant P17 as downloadRecipeImage()
    participant P18 as combineAmounts()
    participant P19 as searchHaystack()
    participant P20 as handleCopy()
    participant P21 as draftFromRecipe()
    participant P22 as buildIdeasPrompt()
    participant P23 as buildBody()
    participant P24 as isVegetarian()
    participant P25 as ingredientLabel()
    participant P26 as handleCopy()
    participant P27 as makeDir()
    participant P28 as seedDatabase()
    participant P29 as notFound()
    participant P30 as runSync()
    participant P31 as checkImportToken()
    participant P32 as rollOverdueRoutines()
    participant P33 as collectTags()
    participant P34 as recipeImageDir()
    participant P35 as classifyShift()
    participant P36 as listRoutineTemplates()
    participant P37 as getAuthUrl()
    participant P38 as exchangeCode()
    participant P39 as isSafeImageFile()
    participant P40 as contentTypeForImage()
    P0->>+ P1: calls
    P1-->>- P0: return
    P1->>+ P0: calls
    P0-->>- P1: return
    P1->>+ P2: calls
    P2-->>- P1: return
    P2->>+ P0: calls
    P0-->>- P2: return
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
    P1->>+ P3: calls
    P3-->>- P1: return
    P1->>+ P19: calls
    P19-->>- P1: return
    P1->>+ P5: calls
    P5-->>- P1: return
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
    P0->>+ P2: calls
    P2-->>- P0: return
    P0->>+ P28: calls
    P28-->>- P0: return
    P0->>+ P18: calls
    P18-->>- P0: return
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
    P0->>+ P40: calls
    P40-->>- P0: return
```

## Connections by Relation

### calls
- [[join]] `INFERRED`
- [[exportRecipes()]] `INFERRED`
- [[seedDatabase()]] `INFERRED`
- [[combineAmounts()]] `INFERRED`
- [[notFound()]] `EXTRACTED`
- [[runSync()]] `EXTRACTED`
- [[checkImportToken()]] `INFERRED`
- [[rollOverdueRoutines()]] `INFERRED`
- [[collectTags()]] `INFERRED`
- [[recipeImageDir()]] `INFERRED`
- [[classifyShift()]] `INFERRED`
- [[listRoutineTemplates()]] `INFERRED`
- [[getAuthUrl()]] `INFERRED`
- [[exchangeCode()]] `INFERRED`
- [[isSafeImageFile()]] `INFERRED`
- [[contentTypeForImage()]] `INFERRED`

### contains
- [[route.ts]] `EXTRACTED`
- [[route.ts]] `EXTRACTED`
- [[route.ts]] `EXTRACTED`
- [[route.ts]] `EXTRACTED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*