import {
  getNarratorWithOtherMedia,
  NarratorWithOtherMedia,
} from "@/src/db/library";
import { useDataVersion } from "@/src/stores/data-version";
import { Session } from "@/src/stores/session";
import { useCallback, useEffect, useState } from "react";

export function useNarratorWithOtherMedia(
  session: Session,
  narratorId: string,
  withoutMediaId: string,
  withoutSeriesIds: string[],
  withoutAuthorIds: string[],
) {
  const [narrator, setNarrator] = useState<NarratorWithOtherMedia | undefined>(
    undefined,
  );
  const libraryDataVersion = useDataVersion(
    (state) => state.libraryDataVersion,
  );

  const load = useCallback(async () => {
    const result = await getNarratorWithOtherMedia(
      session,
      narratorId,
      withoutMediaId,
      withoutSeriesIds,
      withoutAuthorIds,
    );
    setNarrator(result);
  }, [session, narratorId, withoutMediaId, withoutSeriesIds, withoutAuthorIds]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryDataVersion]);

  return { narrator };
}
