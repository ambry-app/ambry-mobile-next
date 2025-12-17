import { Delay } from "@/components";
import { SavedForLaterScreen } from "@/components/screens";
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
