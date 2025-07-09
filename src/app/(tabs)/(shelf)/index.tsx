import { Delay } from "@/src/components";
import { Shelf } from "@/src/components/screens";
import { useSession } from "@/src/stores/session";

export default function ShelfScreen() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return (
    <Delay delay={10}>
      <Shelf session={session} />
    </Delay>
  );
}
