import {
  createDownload,
  deleteDownload,
  getDownload,
  updateDownload,
} from "@/src/db/downloads";
import { DownloadedThumbnails, Thumbnails } from "@/src/db/schema";
import * as FileSystem from "expo-file-system";
import { create } from "zustand";
import { Session } from "./session";

interface DownloadsState {
  downloadProgresses: Record<string, number | undefined>;
  downloadResumables: Record<string, FileSystem.DownloadResumable | undefined>;
  startDownload: (
    session: Session,
    mediaId: string,
    uri: string,
    thumbnails: Thumbnails | null,
  ) => Promise<void>;
  removeDownload: (session: Session, mediaId: string) => Promise<void>;
  cancelDownload: (session: Session, mediaId: string) => Promise<void>;
}

export const useDownloadsStore = create<DownloadsState>((set, get) => ({
  downloadProgresses: {},
  downloadResumables: {},
  startDownload: async (
    session: Session,
    mediaId: string,
    uri: string,
    thumbnails: Thumbnails | null,
  ) => {
    set((state) => ({
      downloadProgresses: {
        ...state.downloadProgresses,
        [mediaId]: 0,
      },
    }));

    const filePath = FileSystem.documentDirectory + `${mediaId}.mp4`;

    console.log("Downloading to", filePath);

    await createDownload(session, mediaId, filePath);
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
      set((state) => ({
        downloadProgresses: {
          ...state.downloadProgresses,
          [mediaId]: progress,
        },
      }));
    };

    const downloadResumable = FileSystem.createDownloadResumable(
      `${session.url}/${uri}`,
      filePath,
      { headers: { Authorization: `Bearer ${session.token}` } },
      progressCallback,
    );

    set((state) => ({
      downloadResumables: {
        ...state.downloadResumables,
        [mediaId]: downloadResumable,
      },
    }));

    try {
      const result = await downloadResumable.downloadAsync();

      if (result) {
        console.log("Download succeeded");
        await updateDownload(session, mediaId, { status: "ready" });
      } else {
        console.log("Download was canceled");
        // TODO: do we delete from db here?
      }
    } catch (error) {
      console.error("Download failed:", error);
      await updateDownload(session, mediaId, { status: "error" });
    } finally {
      set((state) => {
        const { [mediaId]: _dp, ...downloadProgresses } =
          state.downloadProgresses;
        const { [mediaId]: _dr, ...downloadResumables } =
          state.downloadResumables;
        return { downloadProgresses, downloadResumables };
      });
    }
  },
  removeDownload: async (session: Session, mediaId: string) => {
    const download = await getDownload(session, mediaId);
    if (download) await tryDelete(download.filePath);
    if (download?.thumbnails) {
      await tryDelete(download.thumbnails.extraSmall);
      await tryDelete(download.thumbnails.small);
      await tryDelete(download.thumbnails.medium);
      await tryDelete(download.thumbnails.large);
      await tryDelete(download.thumbnails.extraLarge);
    }
    await deleteDownload(session, mediaId);
  },
  cancelDownload: async (session: Session, mediaId: string) => {
    const downloadResumable = get().downloadResumables[mediaId];
    if (downloadResumable) {
      try {
        await downloadResumable.cancelAsync();
      } catch (e) {
        console.error("Error canceling download resumable:", e);
      }
    }
    get().removeDownload(session, mediaId);
  },
}));

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

  console.log("downloading:", downloadedThumbnails);

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

  console.log("done downloading thumbnails!");

  return downloadedThumbnails;
}

async function tryDelete(path: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(path);
  } catch (e) {
    console.error("Failed to delete file:", e);
  }
}
