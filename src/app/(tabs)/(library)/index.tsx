import { LibraryFlatList } from "@/src/components/LibraryScreen";
import { useSession } from "@/src/stores/session";

export default function LibraryScreen() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return <LibraryFlatList session={session} />;
}
