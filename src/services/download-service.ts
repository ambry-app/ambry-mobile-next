import { Paths } from "expo-file-system";
// Legacy imports required for download functionality with progress tracking
// (the new API doesn't support progress callbacks yet)
import * as LegacyFileSystem from "expo-file-system/legacy";

import {
  createDownload,
  deleteDownload,
  getAllDownloads,
  getDownload,
  updateDownload,
} from "@/db/downloads";
import { getMediaDownloadInfo } from "@/db/library";
import { DownloadedThumbnails, Thumbnails } from "@/db/schema";
import {
  addOrUpdateDownload,
  removeDownloadFromStore,
  setDownloadProgress,
  setDownloadResumable,
  useDownloads,
} from "@/stores/downloads";
import { Session } from "@/types/session";
import { documentDirectoryFilePath } from "@/utils";
import { logBase } from "@/utils/logger";

import { reloadCurrentPlaythroughIfMedia } from "./playback-controls";

const log = logBase.extend("download-service");

/**
 * Initialize the downloads store.
 * Loads downloads from DB if not already initialized (context may have persisted).
 */
export async function initializeDownloads(session: Session) {
  if (useDownloads.getState().initialized) {
    log.debug("Already initialized, skipping");
    return;
  }

  log.debug("Initializing");

  const all = await getAllDownloads(session);
  const downloads: Record<string, any> = {};
  for (const d of all) {
    downloads[d.mediaId] = {
      mediaId: d.mediaId,
      filePath: d.filePath,
      status: d.status,
      thumbnails: d.thumbnails,
    };
  }
  useDownloads.setState({ initialized: true, downloads });
}

export async function startDownload(session: Session, mediaId: string) {
  // Query for mp4Path and thumbnails
  const mediaInfo = await getMediaDownloadInfo(session, mediaId);
  if (!mediaInfo?.mp4Path) {
    log.warn("No mp4Path found for media:", mediaId);
    return;
  }

  const { mp4Path, thumbnails } = mediaInfo;
  const destinationFilePath = Paths.document.uri + `${mediaId}.mp4`;

  log.info("Starting download to", destinationFilePath);

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
    downloadProgress: LegacyFileSystem.DownloadProgressData,
  ) => {
    const progress =
      downloadProgress.totalBytesWritten /
      downloadProgress.totalBytesExpectedToWrite;
    setDownloadProgress(mediaId, progress);
  };

  const downloadResumable = LegacyFileSystem.createDownloadResumable(
    `${session.url}/${mp4Path}`,
    destinationFilePath,
    { headers: { Authorization: `Bearer ${session.token}` } },
    progressCallback,
  );

  setDownloadResumable(mediaId, downloadResumable);

  try {
    const result = await downloadResumable.downloadAsync();

    if (result) {
      log.info("Download succeeded for media:", mediaId);
      download = await updateDownload(session, mediaId, {
        status: "ready",
      });
      addOrUpdateDownload(download);
      // reload player if the download is for the currently loaded media
      await reloadCurrentPlaythroughIfMedia(session, mediaId);
    } else {
      log.debug("Download was canceled");
    }
  } catch (error) {
    log.warn("Download failed:", error);
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
      log.warn("Error canceling download resumable:", e);
    }
  }
  await removeDownload(session, mediaId);
}

export async function removeDownload(session: Session, mediaId: string) {
  log.info("Removing download for media:", mediaId);
  const download = await getDownload(session, mediaId);

  if (download) {
    const pathToDelete = documentDirectoryFilePath(download.filePath);
    log.debug("Deleting file:", pathToDelete);
    await tryDelete(pathToDelete);
  }

  if (download?.thumbnails) {
    log.debug("Deleting thumbnails:", download.thumbnails);
    await tryDelete(download.thumbnails.extraSmall);
    await tryDelete(download.thumbnails.small);
    await tryDelete(download.thumbnails.medium);
    await tryDelete(download.thumbnails.large);
    await tryDelete(download.thumbnails.extraLarge);
  }
  await deleteDownload(session, mediaId);
  removeDownloadFromStore(mediaId);

  // reload player if the download is for the currently loaded media
  await reloadCurrentPlaythroughIfMedia(session, mediaId);
}

async function downloadThumbnails(
  session: Session,
  mediaId: string,
  thumbnails: Thumbnails,
): Promise<DownloadedThumbnails> {
  const options = { headers: { Authorization: `Bearer ${session.token}` } };

  const downloadedThumbnails = {
    extraSmall: Paths.document.uri + `${mediaId}-xs.webp`,
    small: Paths.document.uri + `${mediaId}-sm.webp`,
    medium: Paths.document.uri + `${mediaId}-md.webp`,
    large: Paths.document.uri + `${mediaId}-lg.webp`,
    extraLarge: Paths.document.uri + `${mediaId}-xl.webp`,
    thumbhash: thumbnails.thumbhash,
  };

  log.debug("Downloading thumbnails:", downloadedThumbnails);

  await Promise.all([
    LegacyFileSystem.downloadAsync(
      `${session.url}/${thumbnails.extraSmall}`,
      downloadedThumbnails.extraSmall,
      options,
    ),
    LegacyFileSystem.downloadAsync(
      `${session.url}/${thumbnails.small}`,
      downloadedThumbnails.small,
      options,
    ),
    LegacyFileSystem.downloadAsync(
      `${session.url}/${thumbnails.medium}`,
      downloadedThumbnails.medium,
      options,
    ),
    LegacyFileSystem.downloadAsync(
      `${session.url}/${thumbnails.large}`,
      downloadedThumbnails.large,
      options,
    ),
    LegacyFileSystem.downloadAsync(
      `${session.url}/${thumbnails.extraLarge}`,
      downloadedThumbnails.extraLarge,
      options,
    ),
  ]);

  log.debug("Finished downloading thumbnails");

  return downloadedThumbnails;
}

async function tryDelete(path: string): Promise<void> {
  try {
    await LegacyFileSystem.deleteAsync(path);
  } catch (e) {
    log.warn("Failed to delete file:", e);
  }
}
