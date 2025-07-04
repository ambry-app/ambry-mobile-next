import { getSeriesWithBooks, SeriesWithBooks } from "@/src/db/library";
import { useDataVersion } from "@/src/stores/data-version";
import { Session } from "@/src/stores/session";
import { useCallback, useEffect, useState } from "react";

export function useSeriesWithBooks(session: Session, seriesId: string) {
  const [series, setSeries] = useState<SeriesWithBooks | undefined>(undefined);
  const libraryDataVersion = useDataVersion(
    (state) => state.libraryDataVersion,
  );

  const load = useCallback(async () => {
    const result = await getSeriesWithBooks(session, seriesId);
    setSeries(result);
  }, [session, seriesId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryDataVersion]);

  return { series };
}
