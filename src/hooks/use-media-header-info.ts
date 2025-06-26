import { getMediaHeaderInfo, MediaHeaderInfo } from "@/src/db/library";
import { Session } from "@/src/stores/session";
import { useCallback, useEffect, useState } from "react";

export default function useMediaHeaderInfo(session: Session, mediaId: string) {
  const [media, setMedia] = useState<MediaHeaderInfo | null>(null);

  const load = useCallback(async () => {
    const media = await getMediaHeaderInfo(session, mediaId);
    setMedia(media);
  }, [session, mediaId]);

  useEffect(() => {
    load();
  });

  return { media, reload: load };
}
