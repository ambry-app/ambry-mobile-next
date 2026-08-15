import { Directory, File, Paths } from "expo-file-system";

import {
  createDownload,
  deleteDownload,
  getAllDownloads,
  getDownload,
  updateDownload,
} from "@/db/downloads";
import {
  getMediaDownloadInfo,
  type MediaDownloadInfo,
} from "@/db/library/get-media-download-info";
import { DownloadedThumbnails, Thumbnails } from "@/db/schema";
import {
  addOrUpdateDownload,
  removeDownloadFromStore,
  setDownloadProgress,
  useDownloads,
} from "@/stores/downloads";
import { Session } from "@/types/session";
import { logBase } from "@/utils/logger";
import { documentDirectoryFilePath } from "@/utils/paths";
import { serverUrl } from "@/utils/urls";

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
      files: d.files,
      status: d.status,
      thumbnails: d.thumbnails,
    };
  }
  useDownloads.setState({ initialized: true, downloads });
}

/**
 * What a recording's download will consist of.
 *
 * A direct-play recording downloads its own files, keeping their real
 * extensions and living in a folder of its own so a forty-file recording does
 * not litter the document directory. Legacy media downloads the one packaged
 * file it has, at the path it has always used, so existing downloads keep
 * working untouched.
 */
type DownloadPlan =
  | {
      kind: "tracks";
      files: {
        trackId: string;
        remote: string;
        local: string;
        size: number;
      }[];
    }
  | { kind: "legacy"; remote: string; local: string };

function planDownload(
  mediaId: string,
  mediaInfo: MediaDownloadInfo,
): DownloadPlan | null {
  if (mediaInfo.tracks.length > 0) {
    return {
      kind: "tracks",
      files: mediaInfo.tracks.map((track) => ({
        trackId: track.id,
        remote: track.path,
        // Numbered so the folder reads in playback order, and suffixed with
        // the real extension because the player picks its decoder from it.
        local: `${mediaId}/${String(track.index).padStart(3, "0")}${extensionOf(track.path)}`,
        size: track.size,
      })),
    };
  }

  if (mediaInfo.mp4Path) {
    return {
      kind: "legacy",
      remote: mediaInfo.mp4Path,
      local: `${mediaId}.mp4`,
    };
  }

  return null;
}

function extensionOf(path: string): string {
  const name = path.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");

  return dot > 0 ? name.slice(dot) : "";
}

/**
 * Downloads currently in flight, so a cancel can actually stop the transfer
 * rather than only forgetting about it.
 */
const inFlight = new Map<string, AbortController>();

/**
 * How often progress reaches the store. The native callback fires far more
 * often than a progress bar can usefully move, and every update re-renders
 * the downloads screen.
 */
const PROGRESS_REPORT_INTERVAL = 250;

export async function startDownload(session: Session, mediaId: string) {
  const mediaInfo = await getMediaDownloadInfo(session, mediaId);
  const plan = mediaInfo && planDownload(mediaId, mediaInfo);

  if (!plan) {
    // Every audiobook a reader can reach has something to play, so this is a
    // guard against a state that should not exist rather than something to
    // report in the UI.
    log.warn("Nothing downloadable for media:", mediaId);
    return;
  }

  const thumbnails = mediaInfo.thumbnails;
  const localPaths =
    plan.kind === "tracks" ? plan.files.map((f) => f.local) : [plan.local];
  const destinationFilePath = plan.kind === "legacy" ? plan.local : "";

  log.info(`Starting download of ${localPaths.length} file(s) for`, mediaId);

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

  // A direct-play recording knows its total up front, because every file's
  // size is synced along with it. Legacy media has to wait for the server to
  // say how big the one file is.
  const knownTotal =
    plan.kind === "tracks"
      ? plan.files.reduce((total, file) => total + file.size, 0)
      : 0;

  const controller = new AbortController();
  inFlight.set(mediaId, controller);

  const progress = progressReporter(mediaId, knownTotal);

  try {
    // Bytes belonging to files that have already finished, so a multi-file
    // recording reports one running total rather than restarting per file.
    let completedBytes = 0;

    for (const localPath of localPaths) {
      const entry =
        plan.kind === "tracks"
          ? plan.files.find((f) => f.local === localPath)!
          : { remote: plan.remote, size: 0 };

      const file = new File(documentDirectoryFilePath(localPath));
      // A direct-play recording downloads into a folder of its own, which has
      // to exist before anything can be written into it.
      file.parentDirectory.create({ intermediates: true, idempotent: true });
      if (file.exists) file.delete();

      await File.downloadFileAsync(serverUrl(session.url, entry.remote), file, {
        headers: { Authorization: `Bearer ${session.token}` },
        signal: controller.signal,
        onProgress: ({ bytesWritten, totalBytes }) => {
          progress.report(completedBytes + bytesWritten, totalBytes);
        },
      });

      // Prefer the size we were told over the size we were sent: a server
      // without Content-Length reports -1, and the synced size is exact.
      completedBytes += entry.size || file.size;

      // Checked between files as well, so a cancel that lands between two
      // transfers is noticed without waiting for the whole set.
      if (await discardIfCancelled(session, mediaId, localPaths)) return;
    }

    progress.complete(completedBytes);

    log.info("Download succeeded for media:", mediaId);
    download = await updateDownload(session, mediaId, {
      status: "ready",
      files:
        plan.kind === "tracks"
          ? plan.files.map((f) => ({ trackId: f.trackId, path: f.local }))
          : null,
    });
    addOrUpdateDownload(download);
    // reload player if the download is for the currently loaded media
    await reloadCurrentPlaythroughIfMedia(session, mediaId);
  } catch (error) {
    // A cancelled transfer rejects with an AbortError. That is this app
    // cancelling on purpose, not a failure worth reporting.
    if (controller.signal.aborted) {
      log.info("Download cancelled for media:", mediaId);
      await discardIfCancelled(session, mediaId, localPaths);
      return;
    }

    log.warn("Download failed:", error);

    // Nothing in here may throw: every caller of startDownload is
    // fire-and-forget, so an error escaping this handler becomes an unhandled
    // rejection rather than surfacing anywhere useful.
    try {
      if (await discardIfCancelled(session, mediaId, localPaths)) {
        return;
      }

      download = await updateDownload(session, mediaId, { status: "error" });
      addOrUpdateDownload(download);
    } catch (cleanupError) {
      log.warn("Failed to record download failure:", cleanupError);
    }
  } finally {
    inFlight.delete(mediaId);
  }
}

/**
 * Push progress to the store, but no more often than a bar can usefully move.
 *
 * The final call is always let through, so a download never comes to rest
 * showing 98%.
 */
function progressReporter(mediaId: string, knownTotal: number) {
  let lastReportedAt = 0;

  return {
    report(bytesWritten: number, reportedTotal: number) {
      const now = Date.now();
      if (now - lastReportedAt < PROGRESS_REPORT_INTERVAL) return;
      lastReportedAt = now;

      // A server that sends no Content-Length reports -1, which would render
      // as a bar running backwards.
      const total = knownTotal || Math.max(reportedTotal, 0);
      setDownloadProgress(mediaId, bytesWritten, total);
    },

    complete(bytesWritten: number) {
      setDownloadProgress(mediaId, bytesWritten, knownTotal || bytesWritten);
    },
  };
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
  localPaths: string[],
): Promise<boolean> {
  if (await getDownload(session, mediaId)) return false;

  log.info("Download was cancelled while in flight, discarding:", mediaId);
  for (const localPath of localPaths) {
    await tryDelete(documentDirectoryFilePath(localPath));
  }
  await tryDeleteDirectory(mediaId);
  return true;
}

/**
 * Cancel a download, stopping the transfer as well as forgetting it.
 *
 * Aborting first is what frees the bandwidth: this used to be unable to stop a
 * running transfer, so a cancelled forty-file download kept downloading in the
 * background and was only discarded once it finished.
 */
export async function cancelDownload(session: Session, mediaId: string) {
  log.info("Canceling download:", mediaId);

  inFlight.get(mediaId)?.abort();
  await removeDownload(session, mediaId);
}

export async function removeDownload(session: Session, mediaId: string) {
  log.info("Removing download for media:", mediaId);
  const download = await getDownload(session, mediaId);

  if (download) {
    // A direct-play recording keeps its files in a folder of its own; legacy
    // media has the one file it has always had.
    for (const file of download.files ?? []) {
      log.debug("Deleting file:", file.path);
      await tryDelete(documentDirectoryFilePath(file.path));
    }
    await tryDeleteDirectory(mediaId);

    if (download.filePath) {
      const pathToDelete = documentDirectoryFilePath(download.filePath);
      log.debug("Deleting file:", pathToDelete);
      await tryDelete(pathToDelete);
    }
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
      serverUrl(session.url, thumbnails.extraSmall),
      new File(downloadedThumbnails.extraSmall),
      options,
    ),
    File.downloadFileAsync(
      serverUrl(session.url, thumbnails.small),
      new File(downloadedThumbnails.small),
      options,
    ),
    File.downloadFileAsync(
      serverUrl(session.url, thumbnails.medium),
      new File(downloadedThumbnails.medium),
      options,
    ),
    File.downloadFileAsync(
      serverUrl(session.url, thumbnails.large),
      new File(downloadedThumbnails.large),
      options,
    ),
    File.downloadFileAsync(
      serverUrl(session.url, thumbnails.extraLarge),
      new File(downloadedThumbnails.extraLarge),
      options,
    ),
  ]);

  log.debug("Finished downloading thumbnails");

  return downloadedThumbnails;
}

/**
 * Remove a recording's download folder, if it had one.
 */
async function tryDeleteDirectory(mediaId: string): Promise<void> {
  try {
    const directory = new Directory(Paths.document, mediaId);
    if (directory.exists) {
      directory.delete();
    }
  } catch (e) {
    log.warn("Failed to delete download folder:", e);
  }
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
