import { Delay } from "@/src/components";
import { Downloads } from "@/src/components/screens";
import { useSession } from "@/src/stores/session";

export default function DownloadsScreen() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return (
    <Delay delay={10}>
      <Downloads session={session} />
    </Delay>
  );
}
