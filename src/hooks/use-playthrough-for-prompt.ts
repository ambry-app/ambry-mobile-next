import { getPlaythroughById } from "@/db/playthroughs";
import { useLibraryData } from "@/hooks/use-library-data";
import { useSession } from "@/stores/session";

export function usePlaythroughForPrompt(playthroughId: string) {
  const session = useSession((state) => state.session);
  const playthrough = useLibraryData(async () => {
    if (!session) return;
    return getPlaythroughById(session, playthroughId);
  }, [playthroughId]);
  return { playthrough, session };
}
