import { ShelfFlatList } from "@/src/components/ShelfScreen";
import { useSession } from "@/src/stores/session";

export default function ShelfScreen() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return <ShelfFlatList session={session} />;
}
