import LibraryFlatlist from "@/src/components/LibraryScreen/LibraryFlatList";
import useSyncOnFocus from "@/src/hooks/use.sync.on.focus";
import { useSession } from "@/src/stores/session";

export default function LibraryScreen() {
  const session = useSession((state) => state.session);
  useSyncOnFocus();

  if (!session) return null;

  return <LibraryFlatlist session={session} />;
}
