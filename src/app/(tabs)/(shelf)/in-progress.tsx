import { Delay } from "@/src/components";
import { InProgressScreen } from "@/src/components/screens";
import { useSession } from "@/src/stores/session";

export default function InProgressRoute() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return (
    <Delay delay={10}>
      <InProgressScreen session={session} />
    </Delay>
  );
}
