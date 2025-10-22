import {
  createDownload,
  deleteDownload,
  getAllDownloads,
  getDownload,
  updateDownload,
} from "@/src/db/downloads";
import { DownloadedThumbnails, Thumbnails } from "@/src/db/schema";
import { documentDirectoryFilePath } from "@/src/utils";
import * as FileSystem from "expo-file-system/legacy";
import { create } from "zustand";
import { loadMedia, usePlayer } from "./player";
import { Session } from "./session";

export type DownloadStatus = "pending" | "error" | "ready";

export interface Download {
  mediaId: string;
  filePath: string;
  status: DownloadStatus;
  thumbnails?: DownloadedThumbnails | null;
  progress?: number;
  resumable?: FileSystem.DownloadResumable;
}

export interface DownloadsState {
  downloads: Record<string, Download>;
}

export const useDownloads = create<DownloadsState>(() => ({
  downloads: {},
}));

export async function loadAllDownloads(session: Session) {
  const all = await getAllDownloads(session);
  const downloads: Record<string, Download> = {};
  for (const d of all) {
    downloads[d.mediaId] = {
      mediaId: d.mediaId,
      filePath: d.filePath,
      status: d.status,
      thumbnails: d.thumbnails,
    };
  }
  useDownloads.setState({ downloads });
}

function addOrUpdateDownload(download: Download) {
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

function removeDownloadFromStore(mediaId: string) {
  useDownloads.setState((state) => {
    const { [mediaId]: _removed, ...rest } = state.downloads;
    return { downloads: rest };
  });
}

function setDownloadProgress(mediaId: string, progress: number | undefined) {
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

function setDownloadResumable(
  mediaId: string,
  resumable: FileSystem.DownloadResumable | undefined,
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

export async function startDownload(
  session: Session,
  mediaId: string,
  uri: string,
  thumbnails: Thumbnails | null,
) {
  const destinationFilePath = FileSystem.documentDirectory + `${mediaId}.mp4`;

  console.debug("[Downloads] Downloading to", destinationFilePath);

  // FIXME: stored file paths should be relative, not absolute
  let download = await createDownload(session, mediaId, destinationFilePath);
  addOrUpdateDownload(download);
  setDownloadProgress(mediaId, 0);

  if (thumbnails) {
    const downloadedThumbnails = await downloadThumbnails(
      session,
      mediaId,
      thumbnails,
    );
    download = await updateDownload(session, mediaId, {
      thumbnails: downloadedThumbnails,
    });
    addOrUpdateDownload(download);
  }

  const progressCallback = (
    downloadProgress: FileSystem.DownloadProgressData,
  ) => {
    const progress =
      downloadProgress.totalBytesWritten /
      downloadProgress.totalBytesExpectedToWrite;
    setDownloadProgress(mediaId, progress);
  };

  const downloadResumable = FileSystem.createDownloadResumable(
    `${session.url}/${uri}`,
    destinationFilePath,
    { headers: { Authorization: `Bearer ${session.token}` } },
    progressCallback,
  );

  setDownloadResumable(mediaId, downloadResumable);

  try {
    const result = await downloadResumable.downloadAsync();

    if (result) {
      console.debug("[Downloads] Download succeeded");
      download = await updateDownload(session, mediaId, { status: "ready" });
      addOrUpdateDownload(download);
      // reload player if the download is for the currently loaded media
      if (usePlayer.getState().mediaId === mediaId) {
        loadMedia(session, mediaId);
      }
    } else {
      console.debug("[Downloads] Download was canceled");
    }
  } catch (error) {
    console.warn("[Downloads] Download failed:", error);
    download = await updateDownload(session, mediaId, { status: "error" });
    addOrUpdateDownload(download);
  } finally {
    setDownloadResumable(mediaId, undefined);
    setDownloadProgress(mediaId, undefined);
  }
}

export async function cancelDownload(session: Session, mediaId: string) {
  const download = useDownloads.getState().downloads[mediaId];

  if (download?.resumable) {
    try {
      await download.resumable.cancelAsync();
    } catch (e) {
      console.warn("[Downloads] Error canceling download resumable:", e);
    }
  }
  await removeDownload(session, mediaId);
}

export async function removeDownload(session: Session, mediaId: string) {
  console.debug("[Downloads] Removing download for media:", mediaId);
  const download = await getDownload(session, mediaId);

  if (download) {
    const pathToDelete = documentDirectoryFilePath(download.filePath);
    console.debug("[Downloads] deleting file:", pathToDelete);
    await tryDelete(pathToDelete);
  }

  if (download?.thumbnails) {
    console.debug("[Downloads] deleting thumbnails:", download.thumbnails);
    await tryDelete(download.thumbnails.extraSmall);
    await tryDelete(download.thumbnails.small);
    await tryDelete(download.thumbnails.medium);
    await tryDelete(download.thumbnails.large);
    await tryDelete(download.thumbnails.extraLarge);
  }
  await deleteDownload(session, mediaId);
  removeDownloadFromStore(mediaId);

  // reload player if the download is for the currently loaded media
  if (usePlayer.getState().mediaId === mediaId) {
    loadMedia(session, mediaId);
  }
}

async function downloadThumbnails(
  session: Session,
  mediaId: string,
  thumbnails: Thumbnails,
): Promise<DownloadedThumbnails> {
  const options = { headers: { Authorization: `Bearer ${session.token}` } };

  const downloadedThumbnails = {
    extraSmall: FileSystem.documentDirectory + `${mediaId}-xs.webp`,
    small: FileSystem.documentDirectory + `${mediaId}-sm.webp`,
    medium: FileSystem.documentDirectory + `${mediaId}-md.webp`,
    large: FileSystem.documentDirectory + `${mediaId}-lg.webp`,
    extraLarge: FileSystem.documentDirectory + `${mediaId}-xl.webp`,
    thumbhash: thumbnails.thumbhash,
  };

  console.debug("[Downloads] Downloading thumbnails:", downloadedThumbnails);

  await Promise.all([
    FileSystem.downloadAsync(
      `${session.url}/${thumbnails.extraSmall}`,
      downloadedThumbnails.extraSmall,
      options,
    ),
    FileSystem.downloadAsync(
      `${session.url}/${thumbnails.small}`,
      downloadedThumbnails.small,
      options,
    ),
    FileSystem.downloadAsync(
      `${session.url}/${thumbnails.medium}`,
      downloadedThumbnails.medium,
      options,
    ),
    FileSystem.downloadAsync(
      `${session.url}/${thumbnails.large}`,
      downloadedThumbnails.large,
      options,
    ),
    FileSystem.downloadAsync(
      `${session.url}/${thumbnails.extraLarge}`,
      downloadedThumbnails.extraLarge,
      options,
    ),
  ]);

  console.debug("[Downloads] Finished downloading thumbnails");

  return downloadedThumbnails;
}

async function tryDelete(path: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(path);
  } catch (e) {
    console.warn("[Downloads] Failed to delete file:", e);
  }
}
