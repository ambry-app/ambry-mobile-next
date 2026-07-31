import { create } from "zustand";

import { DownloadedThumbnails } from "@/types/db-schema";

export type DownloadStatus = "pending" | "error" | "ready";

export interface Download {
  mediaId: string;
  filePath: string;
  status: DownloadStatus;
  thumbnails?: DownloadedThumbnails | null;
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

export function removeDownloadFromStore(mediaId: string) {
  useDownloads.setState((state) => {
    const { [mediaId]: _removed, ...rest } = state.downloads;
    return { downloads: rest };
  });
}

/**
 * Reset store to initial state for testing.
 */
export function resetForTesting() {
  useDownloads.setState(initialDownloadsState, true);
}
