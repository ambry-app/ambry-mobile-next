import { Delay } from "@/components/Delay";
import { FinishedScreen } from "@/components/screens/FinishedScreen";
import { useSession } from "@/stores/session";

export default function FinishedRoute() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return (
    <Delay delay={10}>
      <FinishedScreen session={session} />
    </Delay>
  );
}
