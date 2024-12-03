import {
  createDownload,
  deleteDownload,
  getDownload,
  updateDownload,
} from "@/src/db/downloads";
import { DownloadedThumbnails, Thumbnails } from "@/src/db/schema";
import { documentDirectoryFilePath } from "@/src/utils/paths";
import * as FileSystem from "expo-file-system";
import { create } from "zustand";
import { Session } from "./session";

export type DownloadProgresses = Partial<Record<string, number>>;
export type DownloadResumables = Partial<
  Record<string, FileSystem.DownloadResumable>
>;

export interface DownloadsState {
  downloadProgresses: DownloadProgresses;
  downloadResumables: DownloadResumables;
}

export const useDownloads = create<DownloadsState>(() => ({
  downloadProgresses: {},
  downloadResumables: {},
}));

export async function startDownload(
  session: Session,
  mediaId: string,
  uri: string,
  thumbnails: Thumbnails | null,
) {
  useDownloads.setState((state) => ({
    downloadProgresses: {
      ...state.downloadProgresses,
      [mediaId]: 0,
    },
  }));

  const destinationFilePath = FileSystem.documentDirectory + `${mediaId}.mp4`;

  console.debug("[Downloads] Downloading to", destinationFilePath);

  // FIXME: stored file paths should be relative, not absolute
  await createDownload(session, mediaId, destinationFilePath);
  if (thumbnails) {
    const downloadedThumbnails = await downloadThumbnails(
      session,
      mediaId,
      thumbnails,
    );
    await updateDownload(session, mediaId, {
      thumbnails: downloadedThumbnails,
    });
  }

  const progressCallback = (downloadProgress: any) => {
    const progress =
      downloadProgress.totalBytesWritten /
      downloadProgress.totalBytesExpectedToWrite;
    useDownloads.setState((state) => ({
      downloadProgresses: {
        ...state.downloadProgresses,
        [mediaId]: progress,
      },
    }));
  };

  const downloadResumable = FileSystem.createDownloadResumable(
    `${session.url}/${uri}`,
    destinationFilePath,
    { headers: { Authorization: `Bearer ${session.token}` } },
    progressCallback,
  );

  useDownloads.setState((state) => ({
    downloadResumables: {
      ...state.downloadResumables,
      [mediaId]: downloadResumable,
    },
  }));

  try {
    const result = await downloadResumable.downloadAsync();

    if (result) {
      console.debug("[Downloads] Download succeeded");
      await updateDownload(session, mediaId, { status: "ready" });
    } else {
      console.debug("[Downloads] Download was canceled");
    }
  } catch (error) {
    console.warn("[Downloads] Download failed:", error);
    await updateDownload(session, mediaId, { status: "error" });
  } finally {
    useDownloads.setState((state) => {
      const { [mediaId]: _dp, ...downloadProgresses } =
        state.downloadProgresses;
      const { [mediaId]: _dr, ...downloadResumables } =
        state.downloadResumables;
      return { downloadProgresses, downloadResumables };
    });
  }
}

export async function cancelDownload(session: Session, mediaId: string) {
  const downloadResumable = useDownloads.getState().downloadResumables[mediaId];

  if (downloadResumable) {
    try {
      await downloadResumable.cancelAsync();
    } catch (e) {
      console.warn("[Downloads] Error canceling download resumable:", e);
    }
  }
  removeDownload(session, mediaId);
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
