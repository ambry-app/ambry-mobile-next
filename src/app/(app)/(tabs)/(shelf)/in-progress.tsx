import { AllInProgress } from "@/src/components/ShelfScreen";
import useSyncOnFocus from "@/src/hooks/use.sync.on.focus";
import { useSession } from "@/src/stores/session";

export default function InProgressScreen() {
  const session = useSession((state) => state.session);
  useSyncOnFocus();

  if (!session) return null;

  return <AllInProgress session={session} />;
}
