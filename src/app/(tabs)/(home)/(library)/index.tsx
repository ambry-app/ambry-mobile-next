import { LibraryScreen } from "@/components/screens/LibraryScreen";
import { useSession } from "@/stores/session";

export default function LibraryRoute() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return <LibraryScreen session={session} />;
}
