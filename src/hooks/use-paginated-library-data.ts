import { useCallback, useEffect, useRef, useState } from "react";
import { useDataVersion } from "@/src/stores/data-version";

export function usePaginatedLibraryData<T, Cursor>(
  pageSize: number,
  getPage: (pageSize: number, cursor?: Cursor | undefined) => Promise<T[]>,
  getCursor: (item: T) => Cursor,
) {
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<Cursor | undefined>(undefined);
  const [items, setItems] = useState<T[] | undefined>(undefined);
  const libraryDataVersion = useDataVersion(
    (state) => state.libraryDataVersion,
  );
  const initialDataVersion = useRef(libraryDataVersion);

  // Initial load (only on mount)
  const loadInitial = useCallback(async () => {
    setLoading(true);

    const page = await getPage(pageSize);

    setItems(page);
    setHasMore(page.length === pageSize);
    setCursor(page.length > 0 ? getCursor(page[page.length - 1]!) : undefined);
    setLoading(false);
  }, [getPage, getCursor, pageSize]);

  // Load next page
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);

    const page = await getPage(pageSize, cursor);

    if (page.length > 0) {
      setItems((prev) => (prev ? [...prev, ...page] : page));
      setCursor(getCursor(page[page.length - 1]!));
    }

    setHasMore(page.length === pageSize);
    setLoading(false);
  }, [getPage, getCursor, cursor, loading, hasMore, pageSize]);

  // Reload all currently loaded items
  const reload = useCallback(async () => {
    setLoading(true);

    const count = items?.length || 0;
    let all: T[] = [];
    let nextCursor: Cursor | undefined = undefined;
    let fetched = 0;

    while (fetched < count) {
      const page = await getPage(pageSize, nextCursor);

      if (page.length === 0) break;

      all = [...all, ...page];
      nextCursor = getCursor(page[page.length - 1]!);
      fetched += page.length;

      if (page.length < count - fetched) break;
    }

    setItems(all);
    setHasMore(all.length >= count);
    setCursor(nextCursor);
    setLoading(false);
  }, [getPage, getCursor, items?.length, pageSize]);

  // Initial load on mount
  useEffect(() => {
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when libraryDataVersion changes (but not on initial mount)
  useEffect(() => {
    if (initialDataVersion.current !== libraryDataVersion) {
      reload();
      initialDataVersion.current = libraryDataVersion;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryDataVersion]);

  return { items, hasMore, loadMore, loading };
}
