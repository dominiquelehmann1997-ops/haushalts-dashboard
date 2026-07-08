import { ShoppingView } from "@/components/mobile/ShoppingView";
import { getShoppingItems } from "@/lib/repositories/shopping";

export const dynamic = "force-dynamic";

export default async function MobileShoppingPage() {
  const items = await getShoppingItems();
  return <ShoppingView items={items} />;
}
