import { create } from "zustand";

import { DownloadedFile, DownloadedThumbnails } from "@/types/db-schema";

export type DownloadStatus = "pending" | "error" | "ready";

export interface Download {
  mediaId: string;
  filePath: string;
  status: DownloadStatus;
  /** A direct-play recording's files. Null for legacy media, which has one. */
  files?: DownloadedFile[] | null;
  thumbnails?: DownloadedThumbnails | null;
  /**
   * Bytes fetched so far across the whole recording, and how many are
   * expected. A recording can be several files, but progress is reported for
   * the recording as a whole: the reader is downloading a book, not a queue.
   *
   * `totalBytes` is 0 until it is known. For direct-play recordings the size
   * of every file is already synced, so it is known before the first byte
   * arrives; for legacy media it comes from the server's Content-Length, and
   * stays 0 if the server does not send one.
   */
  bytesWritten?: number;
  totalBytes?: number;
}

export interface DownloadsState {
  initialized: boolean;
  downloads: Record<string, Download>;
}

export const initialDownloadsState: DownloadsState = {
  initialized: false,
  downloads: {},
};

export const useDownloads = create<DownloadsState>(() => initialDownloadsState);

export function addOrUpdateDownload(download: Download) {
  useDownloads.setState((state) => ({
    downloads: {
      ...state.downloads,
      [download.mediaId]: {
        ...state.downloads[download.mediaId],
        ...download,
      },
    },
  }));
}

/**
 * Record how far a download has got.
 *
 * Kept separate from `addOrUpdateDownload` because progress arrives far more
 * often than anything else changes, and it must not resurrect a download that
 * was cancelled while bytes were still in flight.
 */
export function setDownloadProgress(
  mediaId: string,
  bytesWritten: number,
  totalBytes: number,
) {
  useDownloads.setState((state) => {
    const existing = state.downloads[mediaId];
    if (!existing) return state;

    return {
      downloads: {
        ...state.downloads,
        [mediaId]: { ...existing, bytesWritten, totalBytes },
      },
    };
  });
}

export function removeDownloadFromStore(mediaId: string) {
  useDownloads.setState((state) => {
    const { [mediaId]: _removed, ...rest } = state.downloads;
    return { downloads: rest };
  });
}

/**
 * Reset store to initial state. Called on sign-out so the next sign-in
 * re-initializes from the database for the new session.
 */
export function reset() {
  useDownloads.setState(initialDownloadsState, true);
}

/**
 * Reset store to initial state for testing.
 */
export function resetForTesting() {
  reset();
}
