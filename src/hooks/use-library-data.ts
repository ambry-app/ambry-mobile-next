import { useDataVersion } from "@/src/stores/data-version";
import { useEffect, useState } from "react";

export function useLibraryData<T>(getData: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const libraryDataVersion = useDataVersion(
    (state) => state.libraryDataVersion,
  );

  useEffect(() => {
    const loadData = async () => {
      const result = await getData();
      setData(result);
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryDataVersion, ...deps]);

  return data;
}
