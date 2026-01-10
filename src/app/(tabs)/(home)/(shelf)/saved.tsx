import { Delay } from "@/components/Delay";
import { SavedForLaterScreen } from "@/components/screens/SavedForLaterScreen";
import { useSession } from "@/stores/session";

export default function SavedRoute() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return (
    <Delay delay={10}>
      <SavedForLaterScreen session={session} />
    </Delay>
  );
}
