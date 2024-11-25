import DownloadsFlatList from "@/src/components/DownloadsScreen/DownloadsFlatList";
import { useSession } from "@/src/stores/session";

export default function DownloadsScreen() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return <DownloadsFlatList session={session} />;
}
