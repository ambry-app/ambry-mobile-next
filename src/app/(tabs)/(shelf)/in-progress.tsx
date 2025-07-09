import { Delay } from "@/src/components";
import { AllInProgress } from "@/src/components/screens";
import { useSession } from "@/src/stores/session";

export default function InProgressScreen() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return (
    <Delay delay={10}>
      <AllInProgress session={session} />
    </Delay>
  );
}
