import { Delay } from "@/src/components";
import { DownloadsScreen } from "@/src/components/screens";
import { useSession } from "@/src/stores/session";

export default function DownloadsRoute() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return (
    <Delay delay={10}>
      <DownloadsScreen session={session} />
    </Delay>
  );
}
