import { File, Paths } from "expo-file-system";

import {
  createDownload,
  deleteDownload,
  getAllDownloads,
  getDownload,
  updateDownload,
} from "@/db/downloads";
import { getMediaDownloadInfo } from "@/db/library/get-media-download-info";
import { DownloadedThumbnails, Thumbnails } from "@/db/schema";
import {
  addOrUpdateDownload,
  removeDownloadFromStore,
  useDownloads,
} from "@/stores/downloads";
import { Session } from "@/types/session";
import { logBase } from "@/utils/logger";
import { documentDirectoryFilePath } from "@/utils/paths";

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

  try {
    const file = new File(destinationFilePath);
    if (file.exists) {
      file.delete();
    }

    await File.downloadFileAsync(`${session.url}/${mp4Path}`, file, {
      headers: { Authorization: `Bearer ${session.token}` },
    });

    if (await discardIfCancelled(session, mediaId, destinationFilePath)) return;

    log.info("Download succeeded for media:", mediaId);
    download = await updateDownload(session, mediaId, {
      status: "ready",
    });
    addOrUpdateDownload(download);
    // reload player if the download is for the currently loaded media
    await reloadCurrentPlaythroughIfMedia(session, mediaId);
  } catch (error) {
    log.warn("Download failed:", error);

    // Nothing in here may throw: every caller of startDownload is
    // fire-and-forget, so an error escaping this handler becomes an unhandled
    // rejection rather than surfacing anywhere useful.
    try {
      if (await discardIfCancelled(session, mediaId, destinationFilePath)) {
        return;
      }

      download = await updateDownload(session, mediaId, { status: "error" });
      addOrUpdateDownload(download);
    } catch (cleanupError) {
      log.warn("Failed to record download failure:", cleanupError);
    }
  }
}

/**
 * Detect a download that was cancelled while its transfer was still in flight.
 *
 * `cancelDownload` cannot stop the transfer — the File API has no cancellation —
 * so it deletes the record and lets the transfer run to completion. We only find
 * out here, once it settles.
 *
 * Writing a status at that point would throw, because `updateDownload` requires
 * the row to still exist. Instead, bail out and delete the file the transfer
 * left behind, which would otherwise sit on disk with no record pointing at it
 * and no way to reclaim it through the UI.
 *
 * Returns true when the download was cancelled and the caller should stop.
 */
async function discardIfCancelled(
  session: Session,
  mediaId: string,
  destinationFilePath: string,
): Promise<boolean> {
  if (await getDownload(session, mediaId)) return false;

  log.info("Download was cancelled while in flight, discarding:", mediaId);
  await tryDelete(destinationFilePath);
  return true;
}

/**
 * Cancel a download.
 *
 * The File API has no cancellation, so this cannot stop a transfer that is
 * already running — it removes the record and the partial file, and the
 * transfer runs to completion in the background. `startDownload` notices the
 * missing record when it settles and discards the result (see
 * `discardIfCancelled`).
 *
 * This is the tradeoff for using the new API without resumable/progress
 * complexity: cancelling frees the record immediately but not the bandwidth.
 */
export async function cancelDownload(session: Session, mediaId: string) {
  log.info("Canceling (removing) download:", mediaId);
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
    File.downloadFileAsync(
      `${session.url}/${thumbnails.extraSmall}`,
      new File(downloadedThumbnails.extraSmall),
      options,
    ),
    File.downloadFileAsync(
      `${session.url}/${thumbnails.small}`,
      new File(downloadedThumbnails.small),
      options,
    ),
    File.downloadFileAsync(
      `${session.url}/${thumbnails.medium}`,
      new File(downloadedThumbnails.medium),
      options,
    ),
    File.downloadFileAsync(
      `${session.url}/${thumbnails.large}`,
      new File(downloadedThumbnails.large),
      options,
    ),
    File.downloadFileAsync(
      `${session.url}/${thumbnails.extraLarge}`,
      new File(downloadedThumbnails.extraLarge),
      options,
    ),
  ]);

  log.debug("Finished downloading thumbnails");

  return downloadedThumbnails;
}

async function tryDelete(path: string): Promise<void> {
  try {
    const file = new File(path);
    if (file.exists) {
      file.delete();
    }
  } catch (e) {
    log.warn("Failed to delete file:", e);
  }
}
