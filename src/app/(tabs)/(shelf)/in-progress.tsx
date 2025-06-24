import { AllInProgress } from "@/src/components/ShelfScreen";
import { useSession } from "@/src/stores/session";

export default function InProgressScreen() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return <AllInProgress session={session} />;
}
