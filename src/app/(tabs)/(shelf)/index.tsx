import { Delay } from "@/src/components";
import { ShelfScreen } from "@/src/components/screens";
import { useSession } from "@/src/stores/session";

export default function ShelfRoute() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return (
    <Delay delay={10}>
      <ShelfScreen session={session} />
    </Delay>
  );
}
