// Legacy imports required for download functionality with progress tracking
// (the new API doesn't support progress callbacks yet)
import * as LegacyFileSystem from "expo-file-system/legacy";
import { create } from "zustand";

import { DownloadedThumbnails } from "@/types/db-schema";

export type DownloadStatus = "pending" | "error" | "ready";

export interface Download {
  mediaId: string;
  filePath: string;
  status: DownloadStatus;
  thumbnails?: DownloadedThumbnails | null;
  progress?: number;
  resumable?: LegacyFileSystem.DownloadResumable;
}

export interface DownloadsState {
  initialized: boolean;
  downloads: Record<string, Download>;
}

export const useDownloads = create<DownloadsState>(() => ({
  initialized: false,
  downloads: {},
}));

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

export function setDownloadProgress(
  mediaId: string,
  progress: number | undefined,
) {
  // on iOS, the progress callback fires again after the download is complete, and I've only seen it called with a value of 1.
  const progressToSet = progress === 1 ? undefined : progress;

  useDownloads.setState((state) => {
    const prev = state.downloads[mediaId];
    if (!prev) return state;
    return {
      downloads: {
        ...state.downloads,
        [mediaId]: {
          ...prev,
          progress: progressToSet,
        },
      },
    };
  });
}

export function setDownloadResumable(
  mediaId: string,
  resumable: LegacyFileSystem.DownloadResumable | undefined,
) {
  useDownloads.setState((state) => {
    const prev = state.downloads[mediaId];
    if (!prev) return state;
    return {
      downloads: {
        ...state.downloads,
        [mediaId]: {
          ...prev,
          resumable,
        },
      },
    };
  });
}
