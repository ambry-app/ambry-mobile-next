import {
  getMediaAuthorsAndNarrators,
  MediaAuthorOrNarrator,
} from "@/src/db/library";
import { useDataVersion } from "@/src/stores/data-version";
import { Session } from "@/src/stores/session";
import { useCallback, useEffect, useState } from "react";

export function useMediaAuthorsAndNarrators(session: Session, mediaId: string) {
  const [authorsAndNarrators, setAuthorsAndNarrators] = useState<
    MediaAuthorOrNarrator[] | undefined
  >(undefined);
  const libraryDataVersion = useDataVersion(
    (state) => state.libraryDataVersion,
  );

  const load = useCallback(async () => {
    const data = await getMediaAuthorsAndNarrators(session, mediaId);
    setAuthorsAndNarrators(data);
  }, [session, mediaId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryDataVersion]);

  return { authorsAndNarrators };
}
