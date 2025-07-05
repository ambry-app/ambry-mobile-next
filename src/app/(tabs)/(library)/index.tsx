import { Library } from "@/src/components/screens";
import { useSession } from "@/src/stores/session";

export default function LibraryScreen() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return <Library session={session} />;
}
