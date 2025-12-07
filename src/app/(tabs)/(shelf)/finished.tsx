import { Delay } from "@/src/components";
import { FinishedScreen } from "@/src/components/screens";
import { useSession } from "@/src/stores/session";

export default function FinishedRoute() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return (
    <Delay delay={10}>
      <FinishedScreen session={session} />
    </Delay>
  );
}
