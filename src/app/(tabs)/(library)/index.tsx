import { LibraryScreen } from "@/src/components/screens";
import { useSession } from "@/src/stores/session";

export default function LibraryRoute() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return <LibraryScreen session={session} />;
}
