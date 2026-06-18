import { ShoppingView } from "@/components/mobile/ShoppingView";
import { getShoppingItems, getFreshShoppingState } from "@/lib/repositories/shopping";

export const dynamic = "force-dynamic";

export default async function MobileShoppingPage() {
  const [items, fresh] = await Promise.all([getShoppingItems(), getFreshShoppingState()]);
  return <ShoppingView items={items} fresh={fresh} />;
}
