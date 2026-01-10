import { DownloadsScreen } from "@/components/screens/DownloadsScreen";
import { useSession } from "@/stores/session";

export default function DownloadsRoute() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return <DownloadsScreen session={session} />;
}
