/**
 * Library Service
 *
 * Service layer for library data queries. This provides a clean interface
 * between UI and the database layer, including data-fetching hooks.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/shallow";

import {
  type DownloadedMedia,
  getDownloadedMedia,
  getDownloadedMedia as getDownloadedMediaFromDb,
} from "@/db/library/get-downloaded-media";
import { useDataVersion } from "@/stores/data-version";
import { useDownloads } from "@/stores/downloads";
import { Session } from "@/types/session";

// Re-export all library queries and types for UI consumers
export {
  type AuthorHeaderInfo,
  getAuthorHeaderInfo,
} from "@/db/library/get-author-header-info";
export {
  type BookDetails,
  getBookDetails,
} from "@/db/library/get-book-details";
export {
  type BookOtherEditions,
  getBookOtherEditions,
} from "@/db/library/get-book-other-editions";
export { getBooksByAuthorPage } from "@/db/library/get-books-by-author-page";
export {
  type AuthorWithBooks,
  getBooksByAuthors,
} from "@/db/library/get-books-by-authors";
export { type DownloadedMedia, getDownloadedMedia };
export { getMedia, type Media } from "@/db/library/get-media";
export { getMediaAuthorsAndNarrators } from "@/db/library/get-media-authors-and-narrators";
export { getMediaByNarratorPage } from "@/db/library/get-media-by-narrator-page";
export {
  getMediaByNarrators,
  type MediaByNarratorsType,
} from "@/db/library/get-media-by-narrators";
export { getMediaDownloadInfo } from "@/db/library/get-media-download-info";
export {
  getMediaHeaderInfo,
  type MediaHeaderInfo,
} from "@/db/library/get-media-header-info";
export {
  getMediaPage,
  getSearchedMedia,
  type MediaPage,
  type MediaSearchResult,
} from "@/db/library/get-media-page";
export { getMediaTitle } from "@/db/library/get-media-title";
export {
  getNarratorHeaderInfo,
  type NarratorHeaderInfo,
} from "@/db/library/get-narrator-header-info";
export {
  type AuthorWithOtherBooks,
  getOtherBooksByAuthors,
} from "@/db/library/get-other-books-by-authors";
export {
  getOtherMediaByNarrators,
  type NarratorWithOtherMedia,
} from "@/db/library/get-other-media-by-narrators";
export {
  getPersonHeaderInfo,
  type PersonHeaderInfo,
} from "@/db/library/get-person-header-info";
export {
  getPlaythroughsPage,
  type PlaythroughWithMedia,
} from "@/db/library/get-playthroughs-page";
export { getSeriesBooksPage } from "@/db/library/get-series-books-page";
export { getSeriesDetails } from "@/db/library/get-series-details";
export {
  getSeriesWithBooks,
  type SeriesWithBooks,
} from "@/db/library/get-series-with-books";
export {
  combineAuthorsAndNarrators,
  getAuthorsForBooks,
  getMediaForBooks,
  getNarratorsForMedia,
  getPlaythroughStatusesForMedia,
  getSavedForLaterStatusForMedia,
  type MediaAuthorOrNarrator,
} from "@/db/library/shared-queries";

// Re-export schema types used for display (thumbnails, playthrough status)
export type {
  DownloadedThumbnails,
  PlaythroughStatus,
  Thumbnails,
} from "@/db/schema";

// =============================================================================
// Data Fetching Hooks
// =============================================================================

/**
 * Generic hook for fetching library data that automatically refreshes
 * when the library data version changes (e.g., after a sync).
 */
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

/**
 * Hook for paginated library data with cursor-based pagination.
 * Automatically refreshes when the library data version changes.
 */
export function usePaginatedLibraryData<T, Cursor>(
  pageSize: number,
  getPage: (pageSize: number, cursor?: Cursor | undefined) => Promise<T[]>,
  getCursor: (item: T) => Cursor,
  deps: any[] = [],
) {
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<Cursor | undefined>(undefined);
  const [items, setItems] = useState<T[] | undefined>(undefined);
  const libraryDataVersion = useDataVersion(
    (state) => state.libraryDataVersion,
  );
  const isInitialMount = useRef(true);

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

  useEffect(() => {
    if (isInitialMount.current) {
      loadInitial();
      isInitialMount.current = false;
    } else {
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryDataVersion, ...deps]);

  return { items, hasMore, loadMore, loading };
}

/**
 * Hook for getting downloaded media items.
 * Uses the downloads store to track which media are downloaded.
 */
export function useDownloadedMedia(session: Session) {
  const mediaIds = useDownloads(
    useShallow((state) => Object.keys(state.downloads)),
  );

  // NOTE: if the user has downloaded many media, this could be a large query.
  const media = useLibraryData(
    () => getDownloadedMediaFromDb(session, mediaIds),
    [mediaIds],
  );

  return media;
}
