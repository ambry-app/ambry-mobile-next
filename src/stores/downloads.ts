import {
  createDownload,
  deleteDownload,
  getDownloadFilePath,
  updateDownloadStatus,
} from "@/src/db/downloads";
import * as FileSystem from "expo-file-system";
import { create } from "zustand";
import { Session } from "./session";

interface Download {
  mediaId: string;
  progress: number;
}

interface DownloadsState {
  downloads: Record<string, Download | undefined>;
  startDownload: (session: Session, mediaId: string, uri: string) => void;
  // updateProgress: (mediaId: string, progress: number) => void;
  removeDownload: (session: Session, mediaId: string) => void;
}

export const useDownloadsStore = create<DownloadsState>((set) => ({
  downloads: {},
  startDownload: async (session: Session, mediaId: string, uri: string) => {
    const filePath = FileSystem.documentDirectory + `${mediaId}.mp4`;

    console.log("Downloading to", filePath);

    await createDownload(session, mediaId, filePath);

    const progressCallback = (downloadProgress: any) => {
      const progress =
        downloadProgress.totalBytesWritten /
        downloadProgress.totalBytesExpectedToWrite;
      set((state) => ({
        downloads: {
          ...state.downloads,
          [mediaId]: {
            mediaId,
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
        // download succeeded
        console.log("Download succeeded");
        await updateDownloadStatus(session, mediaId, "ready");
      } else {
        // download was canceled
        console.log("Download was canceled");
        // TODO: do we delete from db here?
      }
    } catch (error) {
      console.error("Download failed:", error);
      await updateDownloadStatus(session, mediaId, "error");
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
