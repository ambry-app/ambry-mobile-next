import { MediaForDetails, getMediaForDetails } from "@/src/db/library";
import { useSession } from "@/src/stores/session";
import { useEffect, useState } from "react";

export function useMediaDetails(mediaId: string | null) {
  const session = useSession((state) => state.session);
  const [media, setMedia] = useState<MediaForDetails | undefined>();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!session) return;
    if (!mediaId) return;

    getMediaForDetails(session, mediaId)
      .then(setMedia)
      .catch((error) => {
        console.error("Failed to load media:", error);
        setError(true);
      });
  }, [mediaId, session]);

  return { media, error };
}
