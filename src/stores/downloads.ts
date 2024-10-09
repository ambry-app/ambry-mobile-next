import {
  createDownload,
  deleteDownload,
  getDownloadFilePath,
  updateDownload,
} from "@/src/db/downloads";
import * as FileSystem from "expo-file-system";
import { create } from "zustand";
import { Session } from "./session";
import { DownloadedThumbnails, Thumbnails } from "../db/schema";

interface Download {
  progress: number;
}

interface DownloadsState {
  downloads: Record<string, Download | undefined>;
  startDownload: (
    session: Session,
    mediaId: string,
    uri: string,
    thumbnails: Thumbnails | null,
  ) => void;
  removeDownload: (session: Session, mediaId: string) => void;
}

export const useDownloadsStore = create<DownloadsState>((set) => ({
  downloads: {},
  startDownload: async (
    session: Session,
    mediaId: string,
    uri: string,
    thumbnails: Thumbnails | null,
  ) => {
    set((state) => ({
      downloads: {
        ...state.downloads,
        [mediaId]: {
          progress: 0,
        },
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
        downloads: {
          ...state.downloads,
          [mediaId]: {
            progress,
          },
        },
      }));
    };

    const downloadResumable = FileSystem.createDownloadResumable(
      `${session.url}/${uri}`,
      filePath,
      { headers: { Authorization: `Bearer ${session.token}` } },
      progressCallback,
    );

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
        const { [mediaId]: _, ...downloads } = state.downloads;
        return { downloads };
      });
    }
  },
  removeDownload: async (session: Session, mediaId: string) => {
    const filePath = await getDownloadFilePath(session, mediaId);
    if (filePath) FileSystem.deleteAsync(filePath);
    await deleteDownload(session, mediaId);
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

  console.log("done!");

  return downloadedThumbnails;
}
