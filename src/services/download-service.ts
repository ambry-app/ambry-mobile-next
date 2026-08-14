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
      files: { trackId: string; remote: string; local: string }[];
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

export async function startDownload(session: Session, mediaId: string) {
  const mediaInfo = await getMediaDownloadInfo(session, mediaId);
  const plan = mediaInfo && planDownload(mediaId, mediaInfo);

  if (!plan) {
    // Nothing downloadable: no direct-play files and no packaged file either.
    // Saying so beats the silent no-op this used to be, where the button did
    // nothing and left no trace.
    log.warn("Nothing downloadable for media:", mediaId);
    await recordUndownloadable(session, mediaId);
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

  try {
    for (const localPath of localPaths) {
      const remote =
        plan.kind === "tracks"
          ? plan.files.find((f) => f.local === localPath)!.remote
          : plan.remote;

      const file = new File(documentDirectoryFilePath(localPath));
      // A direct-play recording downloads into a folder of its own, which has
      // to exist before anything can be written into it.
      file.parentDirectory.create({ intermediates: true, idempotent: true });
      if (file.exists) file.delete();

      await File.downloadFileAsync(joinUrl(session.url, remote), file, {
        headers: { Authorization: `Bearer ${session.token}` },
      });

      // Checked between files rather than only at the end, so cancelling a
      // forty-file download stops at the next boundary instead of running the
      // whole set to completion.
      if (await discardIfCancelled(session, mediaId, localPaths)) return;
    }

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
  }
}

/**
 * Record that a recording cannot be downloaded at all.
 *
 * Surfacing it as a failed download is the point: the alternative was
 * returning silently, which left the user tapping a button that never did
 * anything.
 */
async function recordUndownloadable(session: Session, mediaId: string) {
  try {
    const download = await createDownload(session, mediaId, "");
    addOrUpdateDownload(
      await updateDownload(session, mediaId, { status: "error" }),
    );
    return download;
  } catch (error) {
    log.warn("Failed to record undownloadable media:", error);
  }
}

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
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
