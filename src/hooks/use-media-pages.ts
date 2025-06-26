import { getMediaPage } from "@/src/db/library";
import { Session } from "@/src/stores/session";
import { produce } from "immer";
import { useCallback, useEffect, useState } from "react";

type MediaPage = Awaited<ReturnType<typeof getMediaPage>>;

export default function useMediaPages(session: Session) {
  const PAGE_SIZE = 64;
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastInsertedAt, setLastInsertedAt] = useState<Date | undefined>(
    undefined,
  );
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [media, setMedia] = useState<MediaPage>([]);

  // Initial load or refresh
  const loadInitial = useCallback(async () => {
    setLoading(true);

    const page = await getMediaPage(session, PAGE_SIZE);

    setMedia(page);
    setHasMore(page.length === PAGE_SIZE);
    setLastInsertedAt(page[page.length - 1]?.insertedAt ?? undefined);
    setUpdatedAt(new Date());
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
          draft.push(...page);
        }),
      );
    }

    setHasMore(page.length === PAGE_SIZE);
    setLastInsertedAt(page[page.length - 1]?.insertedAt ?? lastInsertedAt);
    setLoading(false);
  }, [session, lastInsertedAt, loading, hasMore]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  return [media, hasMore, updatedAt, loadMore, loadInitial] as const;
}
