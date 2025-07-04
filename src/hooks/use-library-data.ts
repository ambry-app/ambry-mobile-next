import { useDataVersion } from "@/src/stores/data-version";
import { useCallback, useEffect, useState } from "react";

export function useLibraryData<T>(getData: () => Promise<T>) {
  const [data, setData] = useState<T | undefined>(undefined);
  const libraryDataVersion = useDataVersion(
    (state) => state.libraryDataVersion,
  );

  const loadData = useCallback(async () => {
    const result = await getData();
    setData(result);
  }, [getData]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryDataVersion]);

  return data;
}
