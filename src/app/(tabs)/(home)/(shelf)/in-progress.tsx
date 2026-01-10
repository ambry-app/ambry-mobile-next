import { Delay } from "@/components/Delay";
import { InProgressScreen } from "@/components/screens/InProgressScreen";
import { useSession } from "@/stores/session";

export default function InProgressRoute() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return (
    <Delay delay={10}>
      <InProgressScreen session={session} />
    </Delay>
  );
}
