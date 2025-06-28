import { getMediaPage } from "@/src/db/library";
import { Session } from "@/src/stores/session";
import { produce } from "immer";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDataVersion } from "@/src/stores/dataVersion";

type MediaPage = Awaited<ReturnType<typeof getMediaPage>>;

export function useMediaPages(session: Session) {
  const PAGE_SIZE = 64;
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastInsertedAt, setLastInsertedAt] = useState<Date | undefined>(
    undefined,
  );
  const [media, setMedia] = useState<MediaPage | null>(null);
  const libraryDataVersion = useDataVersion(
    (state) => state.libraryDataVersion,
  );
  const initialDataVersion = useRef(libraryDataVersion);

  // Initial load (only on mount)
  const loadInitial = useCallback(async () => {
    setLoading(true);

    const page = await getMediaPage(session, PAGE_SIZE);

    setMedia(page);
    setHasMore(page.length === PAGE_SIZE);
    setLastInsertedAt(page[page.length - 1]?.insertedAt ?? undefined);
    setLoading(false);
  }, [session]);

  // Load next page
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);

    const page = await getMediaPage(session, PAGE_SIZE, lastInsertedAt);

    if (page.length > 0) {
      setMedia(
        produce((draft) => {
          if (!draft) draft = [];
          draft.push(...page);
        }),
      );
    }

    setHasMore(page.length === PAGE_SIZE);
    setLastInsertedAt(page[page.length - 1]?.insertedAt ?? lastInsertedAt);
    setLoading(false);
  }, [session, lastInsertedAt, loading, hasMore]);

  // Reload all currently loaded items
  const reload = useCallback(async () => {
    setLoading(true);

    const count = media?.length || PAGE_SIZE;
    const page = await getMediaPage(session, count);

    setMedia(page);
    setHasMore(page.length === PAGE_SIZE);
    setLastInsertedAt(page[page.length - 1]?.insertedAt ?? undefined);
    setLoading(false);
  }, [media?.length, session]);

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

  return { media, hasMore, loadMore };
}
