import { PageHeader } from "@/components/mobile/PageHeader";
import { RecipeEditor } from "@/components/mobile/RecipeEditor";

export const dynamic = "force-dynamic";

export default function MobileNewRecipePage() {
  return (
    <div className="space-y-3">
      <PageHeader eyebrow="Rezepte" title="Neues Rezept" />
      <RecipeEditor />
    </div>
  );
}
