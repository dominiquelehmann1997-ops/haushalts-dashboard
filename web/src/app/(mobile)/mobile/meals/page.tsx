import { MealDraftPanel } from "@/components/MealDraftPanel";

export default function MobileMealsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-4">Essensplan</h1>
      {/* Wir binden den bestehenden DraftPanel für die Steuerung ein */}
      <MealDraftPanel />
    </div>
  );
}
