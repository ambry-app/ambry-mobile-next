import { Delay } from "@/components/Delay";
import { ShelfScreen } from "@/components/screens/ShelfScreen";
import { useSession } from "@/stores/session";

export default function ShelfRoute() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return (
    <Delay delay={10}>
      <ShelfScreen session={session} />
    </Delay>
  );
}
