// Shared UI-facing domain types / DTOs.
//
// Single source of truth for the shapes the existing UI components expect:
// these are re-exported from `./data.ts` so later phases can map DB rows onto
// exactly what the components render — without changing how anything looks and
// without the two files drifting apart.
//
// In Phase 8 `data.ts` is reduced to types + `PERSON` styles; these re-exports
// stay valid because the type declarations remain there.

export type {
  PersonKey,
  TaskStatus,
  Task,
  Appointment,
  ShoppingItem,
  FreshShoppingState,
  Meal,
  DraftMeal,
  RecipeOption,
  Note,
  PersonStyle,
} from "./data";
