/**
 * Track Player Service.
 *
 * This service provides a higher-level API for interacting with the Track
 * Player, managing playback state, progress tracking, and playthrough data. It
 * keeps the Zustand store in sync with the underlying Track Player and
 * database.
 */

import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as BackgroundTimer from "background-timer";

import {
  getEffectivePosition,
  getPlaythrough,
  type PlaythroughWithMedia,
} from "@/db/playthroughs";
import type { BookSnapshot } from "@/services/track-player-wrapper";
import * as TrackPlayer from "@/services/track-player-wrapper";
import { useDataVersion } from "@/stores/data-version";
import {
  initialState,
  PlayPauseSource,
  type PlayPauseSourceType,
  PlayPauseType,
  type ProgressWithPercent,
  resetForTesting as resetTrackPlayerStore,
  SeekSource,
  type SeekSourceType,
  useTrackPlayer,
} from "@/stores/track-player";
import { Chapter } from "@/types/db-schema";
import { type Session } from "@/types/session";
import { AddTrack, Progress, TrackType } from "@/types/track-player";
import { logBase } from "@/utils/logger";
import { documentDirectoryFilePath } from "@/utils/paths";
import { type TimelineTrack } from "@/utils/playback-timeline";
import { subscribeToChange } from "@/utils/subscribe";
import { recordingTitle } from "@/utils/titles";
import { serverUrl } from "@/utils/urls";

import { getSession } from "./session-service";

const log = logBase.extend("track-player-service");

type PlayPauseDirection = "play" | "pause";

let awaitingIsPlayingMatch: PlayPauseDirection | null = null;

let unsubscribeFunctions: (() => void)[] = [];

// =============================================================================
// Public API
// =============================================================================

/**
 * Initialize the Track Player service and store.
 */
export async function initialize() {
  if (isInitialized()) {
    log.debug("Already initialized, skipping");
    return;
  }

  await setupPlayer();
  setupTrackPlayerListeners();
  setupStoreSubscriptions();

  useTrackPlayer.setState({ initialized: true });
  log.debug("Initialized");
}

// Playback Control

/**
 * Start playback.
 */
export async function play(source: PlayPauseSourceType) {
  log.debug(`play (source: ${source})`);

  const { playthrough, playbackRate } = useTrackPlayer.getState();
  if (!playthrough) {
    log.warn("play() called with no playthrough loaded");
    return;
  }

  const { position } = getAccurateProgress();
  const timestamp = Date.now();

  awaitingIsPlayingMatch = "play";

  await TrackPlayer.play();

  emitPlayPauseEvent({
    direction: "play",
    source,
    timestamp,
    position,
    playbackRate,
    playthroughId: playthrough.id,
  });
}

/**
 * Pause playback.
 *
 * @param source - The source of the pause action
 * @param rewindSeconds - Optional seconds to rewind after pausing (multiplied by playback rate)
 */
export async function pause(
  source: PlayPauseSourceType,
  rewindSeconds?: number,
) {
  log.debug(`pause (source: ${source}, rewind: ${rewindSeconds ?? 0}s)`);

  const { playthrough, playbackRate } = useTrackPlayer.getState();
  if (!playthrough) {
    log.warn("pause() called with no playthrough loaded");
    return;
  }

  const { position, duration } = getAccurateProgress();
  const timestamp = Date.now();

  awaitingIsPlayingMatch = "pause";

  await TrackPlayer.pause();

  emitPlayPauseEvent({
    direction: "pause",
    source,
    timestamp,
    position,
    playbackRate,
    playthroughId: playthrough.id,
  });

  if (rewindSeconds) {
    const rewindAmount = rewindSeconds * playbackRate;
    const newPosition = Math.max(
      0,
      Math.min(position - rewindAmount, duration),
    );
    log.debug(
      `Rewinding from ${position.toFixed(1)} to ${newPosition.toFixed(1)}`,
    );
    await seekTo(newPosition, SeekSource.INTERNAL);
  }
}

/**
 * Pause playback if currently playing. No-op if not playing.
 *
 * @param source - The source of the pause action
 * @param rewindSeconds - Optional seconds to rewind after pausing (multiplied by playback rate)
 */
export async function pauseIfPlaying(
  source: PlayPauseSourceType,
  rewindSeconds?: number,
) {
  const { playing } = isPlaying();
  if (playing) {
    await pause(source, rewindSeconds);
  }
}

/**
 * Seek to a specific position in the track.
 *
 * This immediately updates the store's progress after seeking, and tracks the
 * seek event with captured playthrough context. Chapter state is also updated.
 */
export async function seekTo(position: number, source: SeekSourceType) {
  log.debug(`seekTo ${position.toFixed(1)}`);

  const { playthrough, playbackRate } = useTrackPlayer.getState();
  if (!playthrough) {
    log.warn("seekTo() called with no playthrough loaded");
    return;
  }

  const timestamp = Date.now();
  const beforeProgress = getProgress();

  await TrackPlayer.seekTo(position);
  const progress = getAccurateProgress();

  useTrackPlayer.setState({
    lastSeek: {
      timestamp,
      source,
      playthroughId: playthrough.id,
      playbackRate,
      from: beforeProgress.position,
      // Record the position we asked for, not what the player reports. A
      // stalled or errored streaming player can report a bogus position (0)
      // after a seek; recording that would rewrite history with a jump the
      // user never made.
      to: position,
    },
    ...buildNewProgress(progress),
  });
}

/**
 * Set the playback rate and update the store.
 *
 * Emits a lastRateChange event with captured playthrough context.
 */
export async function setPlaybackRate(rate: number) {
  log.debug(`setPlaybackRate ${rate}`);

  const {
    playthrough,
    progress,
    playbackRate: previousRate,
  } = useTrackPlayer.getState();

  await TrackPlayer.setRate(rate);
  const currentRate = TrackPlayer.getRate();

  const lastRateChange = playthrough
    ? {
        timestamp: Date.now(),
        playthroughId: playthrough.id,
        position: progress.position,
        previousRate,
        newRate: currentRate,
      }
    : null;

  useTrackPlayer.setState({ playbackRate: currentRate, lastRateChange });
}

// State Queries

/**
 * Get the currently loaded playthrough from the store.
 */
export function getLoadedPlaythrough() {
  log.debug("getPlaythrough");
  const { playthrough } = useTrackPlayer.getState();
  return playthrough;
}

/**
 * Get progress from the store.
 *
 * This is only updated every second while playing. For accurate progress, use
 * `getAccurateProgress` instead.
 */
export function getProgress() {
  log.silly("getProgress");
  const { progress } = useTrackPlayer.getState();
  return progress;
}

/**
 * Progress straight from the player's mirror, bypassing the store. Falls back
 * to the store's last-known progress when the player has lost its track (a
 * zeroed duration): treating those zeros as truth is how a bad patch of
 * connectivity used to turn into a recorded "seek to 0" that destroyed the
 * listening position.
 */
export function getAccurateProgress(): ProgressWithPercent {
  log.silly("getAccurateProgress");
  const progress = TrackPlayer.getProgress();
  const trusted =
    progress.duration > 0 ? progress : useTrackPlayer.getState().progress;
  return withPercent(trusted);
}

/**
 * Progress for display, re-rendering when the displayed second changes - at
 * 2x that is twice a second, the same rate-scaled clock the lock screen
 * shows. Paused, it follows the store.
 */
export function useDisplayProgress(): ProgressWithPercent {
  const storeProgress = useTrackPlayer((s) => s.progress);
  const playing = useTrackPlayer((s) => s.isPlaying.playing);
  const playbackRate = useTrackPlayer((s) => s.playbackRate);
  const [sampled, setSampled] = useState<ProgressWithPercent | null>(null);

  useEffect(() => {
    if (!playing) return;

    // A plain interval on purpose: this drives mounted UI, which is
    // foreground by definition. See the services timer rule in CLAUDE.md.
    // eslint-disable-next-line no-restricted-globals
    const interval = setInterval(
      () => {
        setSampled((previous) => {
          const next = getAccurateProgress();
          return previous &&
            Math.floor(previous.position) === Math.floor(next.position)
            ? previous
            : next;
        });
      },
      Math.max(1000 / playbackRate, 100),
    );
    return () => {
      // eslint-disable-next-line no-restricted-globals
      clearInterval(interval);
      setSampled(null);
    };
  }, [playing, playbackRate]);

  return sampled ?? storeProgress;
}

/**
 * Get the current chapter from the store.
 */
export function getCurrentChapter() {
  log.debug("getCurrentChapter");
  const { currentChapter } = useTrackPlayer.getState();
  return currentChapter;
}

/**
 * Get the previous chapter from the store.
 */
export function getPreviousChapter() {
  log.debug("getPreviousChapter");
  const { previousChapter } = useTrackPlayer.getState();
  return previousChapter;
}

/**
 * Get the current playback rate from the store.
 */
export function getPlaybackRate() {
  log.debug("getPlaybackRate");
  const { playbackRate } = useTrackPlayer.getState();
  return playbackRate;
}

/**
 * Get isPlaying state from the store.
 */
export function isPlaying() {
  log.debug("isPlaying");
  const { isPlaying } = useTrackPlayer.getState();
  return isPlaying;
}

// Playthrough Management

/**
 * Load a playthrough into TrackPlayer.
 *
 * V2: Position is determined by comparing state cache (crash recovery) and
 * playthrough (derived from events). We use whichever was updated more recently.
 * Rate comes from the playthrough (derived from events).
 */
export async function loadPlaythroughIntoPlayer(
  session: Session,
  playthrough: PlaythroughWithMedia,
): Promise<void> {
  log.info(`Loading playthrough into player ${playthrough.id}`);

  awaitingIsPlayingMatch = null;

  const streaming = playthrough.media.download?.status !== "ready";

  // Get position from whichever source was updated more recently
  // (state cache from heartbeat vs playthrough from events)
  const position = getEffectivePosition(playthrough);
  const playbackRate = playthrough.playbackRate;

  const { tracks, timeline } = buildQueue(session, playthrough);

  const loaded = {
    id: playthrough.id,
    mediaId: playthrough.mediaId,
    // Cast is safe - we never load deleted playthroughs into the player
    status: playthrough.status as "in_progress" | "finished" | "abandoned",
  };

  await TrackPlayer.reset();

  // Reset store state immediately after reset, before loading new track. This
  // syncs the store with TrackPlayer's None state. As we load the track,
  // TrackPlayer will fire PlaybackState events that update the store via event
  // listeners. We must NOT overwrite playbackState/playWhenReady/isPlaying at
  // the end, or we'll create a race condition where the store ends up in None
  // state even though TrackPlayer is Ready.
  //
  // The playthrough is the exception, and goes in here rather than at the end:
  // it is what the UI mounts the player on, so clearing it unmounts the player
  // for as long as the load takes. The loading screen would vanish, the screen
  // behind it would reappear, and the player would pop back in once the load
  // finished. Everything else is zeroed as before, and the `loadingNewMedia`
  // scrim hides the player's contents until the real values land below.
  useTrackPlayer.setState({ ...initialState, playthrough: loaded });

  await TrackPlayer.add(tracks, timeline);
  await TrackPlayer.seekTo(position);
  await TrackPlayer.setRate(playbackRate);

  const progress = withPercent(await waitForValidProgress());
  const actualPlaybackRate = TrackPlayer.getRate();

  // Only set fields we explicitly manage. playbackState, playWhenReady, and
  // isPlaying are managed by event listeners and must not be overwritten here.
  useTrackPlayer.setState({
    playbackRate: actualPlaybackRate,
    progress,
    streaming,
    playthrough: loaded,
    ...buildInitialChapterState(playthrough.media.chapters, progress),
  });
}

/**
 * Reload the current playthrough into TrackPlayer without resetting the UI state.
 *
 * This is used for seamless switching between streaming and downloaded content
 * (or vice versa) when the underlying media source changes.
 *
 * Note that this calls TrackPlayer directly rather than going through `play()`
 * and `pause()`, so the resulting transitions are reported as EXTERNAL rather
 * than INTERNAL. That is deliberate, not an oversight: routing it through the
 * wrappers would tag the pair INTERNAL and suppress it, which is only correct
 * while the reload succeeds. If the new source cannot be played - the download
 * was deleted and the device is offline, say - the resume never lands, and the
 * unsuppressed pause is what records that playback actually stopped and stops
 * the position heartbeat. See `reloadCurrentPlaythroughIfMedia`.
 */
export async function reloadCurrentPlaythrough(
  session: Session,
  playthrough: PlaythroughWithMedia,
): Promise<void> {
  const current = getLoadedPlaythrough();
  if (!current || current.id !== playthrough.id) {
    return;
  }

  log.info(`Reloading current playthrough ${playthrough.id}`);

  // Capture current state
  const { playing } = isPlaying();
  const { position } = getAccurateProgress();

  // Reset native player only (clears queue/media)
  await TrackPlayer.reset();

  // Load new track configuration (switches URL between file/stream)
  const { tracks, timeline } = buildQueue(session, playthrough);
  await TrackPlayer.add(tracks, timeline);

  // Restore state
  await TrackPlayer.seekTo(position);
  await TrackPlayer.setRate(playthrough.playbackRate);

  // Update store with new derivation (e.g. streaming status changed)
  const streaming = playthrough.media.download?.status !== "ready";

  useTrackPlayer.setState({
    streaming,
    playthrough: {
      id: playthrough.id,
      mediaId: playthrough.mediaId,
      status: playthrough.status as "in_progress" | "finished" | "abandoned",
    },
  });

  if (playing) {
    await TrackPlayer.play();
  }
}

/**
 * Unloads the current playthrough from TrackPlayer and resets state.
 */
export async function unload() {
  log.debug("unload");
  awaitingIsPlayingMatch = null;
  useTrackPlayer.setState(initialState);
  return TrackPlayer.reset();
}

// =============================================================================
// Internals
// =============================================================================

/**
 * Check if the Track Player store is initialized.
 */
function isInitialized() {
  return useTrackPlayer.getState().initialized;
}

/**
 * Every player snapshot - each discontinuity, plus once a second while
 * playing - lands in the store in one write: state, isPlaying, and (when the
 * player knows where it is) progress and chapters.
 */
function setupTrackPlayerListeners() {
  TrackPlayer.onSnapshot(handleSnapshot);
}

function handleSnapshot(snapshot: BookSnapshot) {
  const previous = useTrackPlayer.getState().isPlaying;
  const derived = deriveIsPlaying(snapshot);
  const isPlaying =
    previous.playing === derived.playing &&
    previous.bufferingDuringPlay === derived.bufferingDuringPlay
      ? previous
      : derived;

  useTrackPlayer.setState({
    state: snapshot.state,
    playWhenReady: snapshot.playWhenReady,
    isPlaying,
    ...(snapshot.progress.duration > 0
      ? buildNewProgress(withPercent(snapshot.progress))
      : {}),
  });
}

/**
 * Subscribes to stores to keep data in sync.
 */
function setupStoreSubscriptions() {
  unsubscribeFunctions.push(
    subscribeToChange(
      useDataVersion,
      (s) => s.playthroughDataVersion,
      () => {
        const session = getSession();
        const loadedPlaythrough = getLoadedPlaythrough();

        if (!loadedPlaythrough) return;

        updatePlaythrough(session, loadedPlaythrough.id);
      },
    ),
  );

  unsubscribeFunctions.push(
    subscribeToChange(
      useTrackPlayer,
      (s) => s.isPlaying.playing,
      handleIsPlayingChanged,
    ),
  );
}

/**
 * Set up the player. The module configures itself natively (speech content
 * type, spoken-audio session, interruption handling).
 */
async function setupPlayer() {
  try {
    await TrackPlayer.setupPlayer();
  } catch (error) {
    log.error("setupPlayer failed", error);
    return;
  }

  log.debug("setupPlayer succeeded");
}

/**
 * Build new progress state.
 */
function buildNewProgress(progress: ProgressWithPercent) {
  return { progress, ...buildNewChapterState(progress) };
}

/**
 * Build initial chapter state based on chapters and progress.
 */
function buildInitialChapterState(
  chapters: Chapter[],
  progress: ProgressWithPercent,
) {
  return {
    chapters,
    ...getCurrentAndPreviousChapter(chapters, progress),
  };
}

/**
 * Build new chapter state based on progress.
 */
function buildNewChapterState(progress: ProgressWithPercent) {
  const { chapters, currentChapter } = useTrackPlayer.getState();

  if (
    currentChapter &&
    (progress.position < currentChapter.startTime ||
      (currentChapter.endTime && progress.position >= currentChapter.endTime))
  ) {
    return getCurrentAndPreviousChapter(chapters, progress);
  } else {
    return {};
  }
}

/**
 * Get the current and previous chapters based on progress.
 */
function getCurrentAndPreviousChapter(
  chapters: Chapter[],
  progress: ProgressWithPercent,
) {
  if (chapters.length === 0) {
    return { currentChapter: null, previousChapter: null };
  }

  let currentChapter: Chapter | null = null;
  let previousChapter: Chapter | null = null;

  for (let index = 0; index < chapters.length; index++) {
    const chapter = chapters[index]!;
    if (progress.position < (chapter.endTime || progress.duration)) {
      currentChapter = chapter;
      previousChapter = index > 0 ? chapters[index - 1]! : null;
      break;
    }
  }

  return { currentChapter, previousChapter };
}

/**
 * Update playthrough data from the DB.
 */
async function updatePlaythrough(session: Session, playthroughId: string) {
  const playthrough = await getPlaythrough(session, playthroughId);

  const currentPlaythrough = getLoadedPlaythrough();
  if (!currentPlaythrough || currentPlaythrough.id !== playthroughId) {
    log.debug(
      "updatePlaythrough: playthrough was unloaded during fetch, skipping update",
    );
    return;
  }

  useTrackPlayer.setState({
    playthrough: {
      id: playthrough.id,
      mediaId: playthrough.mediaId,
      // Cast is safe - we never load deleted playthroughs into the player
      status: playthrough.status as "in_progress" | "finished" | "abandoned",
    },
  });
}

/**
 * `playing` means "intends to play and could" - it stays true through a
 * buffering stall, which is what keeps a stall from being recorded as an
 * external pause.
 */
function deriveIsPlaying(snapshot: BookSnapshot) {
  return {
    playing:
      snapshot.playWhenReady &&
      snapshot.state !== "idle" &&
      snapshot.state !== "ended",
    bufferingDuringPlay:
      snapshot.playWhenReady && snapshot.state === "buffering",
  };
}

function withPercent(progress: Progress): ProgressWithPercent {
  return {
    ...progress,
    percent:
      progress.duration > 0 ? (progress.position / progress.duration) * 100 : 0,
  };
}

/**
 * A freshly loaded single-file queue reports duration 0 until the player has
 * buffered enough to know better; wait for the snapshot that knows. Falls
 * back to the store's last-known progress if none arrives.
 */
async function waitForValidProgress(
  timeoutMs: number = 2000,
): Promise<Progress> {
  const immediate = TrackPlayer.getProgress();
  if (immediate.duration > 0) return immediate;

  return new Promise((resolve) => {
    let unsubscribe: (() => void) | null = null;
    let timer: BackgroundTimer.BackgroundTimerHandle | null = null;
    const finish = (progress: Progress) => {
      unsubscribe?.();
      BackgroundTimer.cancel(timer);
      resolve(progress);
    };
    unsubscribe = TrackPlayer.onSnapshot((snapshot) => {
      if (snapshot.progress.duration > 0) finish(snapshot.progress);
    });
    timer = BackgroundTimer.schedule(() => {
      const lastKnown = useTrackPlayer.getState().progress;
      log.warn(
        `waitForValidProgress: no valid duration from player, falling back to last-known progress (${lastKnown.position.toFixed(1)})`,
      );
      finish(lastKnown);
    }, timeoutMs);
  });
}

/** A queue and the timeline that describes it. Never one without the other. */
export type Queue = {
  tracks: AddTrack[];
  timeline: TimelineTrack[];
};

/**
 * Build the player's queue for a playthrough, with its timeline.
 *
 * A direct-play recording is its files in order; legacy media is the single
 * packaged stream it has always been. Every entry carries the same title,
 * artist and artwork, so the lock screen and notification describe the book
 * rather than announcing which file is playing.
 *
 * **The timeline comes back with the queue because the two describe the same
 * thing and are wrong apart.** `track-player-wrapper` translates book seconds
 * against the timeline and skips against the queue, so a timeline of forty
 * files over a queue of one sends `skip(37, …)` into a player holding a single
 * track. Callers used to pass `media.mediaTracks` alongside separately, which
 * was true only for as long as nothing could make the queue disagree with it —
 * and the fallback below is exactly that.
 */
function buildQueue(
  session: Session,
  playthrough: PlaythroughWithMedia,
): Queue {
  const shared = {
    title: recordingTitle(
      playthrough.media.title,
      playthrough.media.book.title,
    ),
    artist: playthrough.media.book.bookAuthors
      .map((bookAuthor) => bookAuthor.author.name)
      .join(", "),
  };

  const tracks = playthrough.media.mediaTracks;
  const legacyFile = strandedLegacyFile(playthrough);

  if (tracks.length > 0 && !legacyFile) {
    return {
      tracks: tracks.map((track) => ({
        ...shared,
        ...directPlaySource(session, playthrough, track),
        duration: track.duration,
      })),
      timeline: tracks,
    };
  }

  return {
    tracks: [
      {
        ...shared,
        ...(legacyFile
          ? localSource(legacyFile, playthrough)
          : legacySource(session, playthrough)),
        duration: playthrough.media.duration
          ? parseFloat(playthrough.media.duration)
          : undefined,
      },
    ],
    // One file holding the whole book needs no translation, which is what an
    // empty timeline means to the wrapper.
    timeline: [],
  };
}

/**
 * The downloaded packaged file of a recording that has since gained tracks,
 * if that is the situation we are in.
 *
 * The back-catalogue reclaim relinks a legacy recording to its original files
 * and gives it tracks. Anyone holding a download of it has a perfectly good
 * copy of the same book on disk, keyed to nothing the new tracks mention — so
 * without this the queue would be built from the tracks, no local file would
 * match any of them, and the reader would silently start streaming a book they
 * had already downloaded, over whatever connection they happen to be on.
 *
 * Playing their copy is unambiguous: it is one file and it is the whole book.
 *
 * The condition is deliberately narrow. `filePath` is only ever set for a
 * legacy download (`download-service` writes `""` for a direct-play one), so a
 * *per-track* download whose tracks were replaced by a re-scan does not land
 * here — its local files are keyed by track id precisely so that a re-scan
 * invalidates them rather than mapping playback onto the wrong file, and
 * guessing an order for them would be exactly that mistake. Those re-download.
 */
function strandedLegacyFile(playthrough: PlaythroughWithMedia) {
  const download = playthrough.media.download;
  if (download?.status !== "ready") return null;
  if (playthrough.media.mediaTracks.length === 0) return null;
  if (!download.filePath) return null;

  const hasLocalTrack = playthrough.media.mediaTracks.some((track) =>
    download.files?.some((file) => file.trackId === track.id),
  );

  return hasLocalTrack ? null : download.filePath;
}

type MediaTrack = PlaythroughWithMedia["media"]["mediaTracks"][number];

/**
 * Where one file of a direct-play recording comes from.
 *
 * A downloaded recording plays from disk, file by file. A file with no local
 * copy still streams, so a download that was interrupted part-way through
 * degrades to a mixed queue rather than refusing to play.
 *
 * `TrackType.Default` is right for every plain audio file: the type only
 * distinguishes streaming manifests, which direct-play never uses.
 */
function directPlaySource(
  session: Session,
  playthrough: PlaythroughWithMedia,
  track: MediaTrack,
) {
  const download = playthrough.media.download;
  const localPath =
    download?.status === "ready"
      ? download.files?.find((file) => file.trackId === track.id)?.path
      : undefined;

  if (localPath) {
    return {
      url: documentDirectoryFilePath(localPath),
      type: TrackType.Default,
      artwork: download?.thumbnails
        ? documentDirectoryFilePath(download.thumbnails.extraLarge)
        : undefined,
    };
  }

  return {
    url: serverUrl(session.url, track.path),
    type: TrackType.Default,
    artwork: playthrough.media.thumbnails
      ? serverUrl(session.url, playthrough.media.thumbnails.extraLarge)
      : undefined,
    headers: { Authorization: `Bearer ${session.token}` },
  };
}

/**
 * A file on this device, with the artwork that was downloaded beside it.
 *
 * No `type`: the packaged mp4 is a plain file to the player, and letting it
 * sniff the container is what makes this work for both the pre-tracks case and
 * a recording that has since gained them.
 */
function localSource(path: string, playthrough: PlaythroughWithMedia) {
  const download = playthrough.media.download;

  return {
    url: documentDirectoryFilePath(path),
    artwork: download?.thumbnails
      ? documentDirectoryFilePath(download.thumbnails.extraLarge)
      : undefined,
  };
}

/**
 * Where legacy packaged media comes from: the downloaded mp4 if there is one,
 * otherwise the streaming manifest — HLS on iOS, DASH elsewhere.
 */
function legacySource(session: Session, playthrough: PlaythroughWithMedia) {
  const download = playthrough.media.download;

  if (download?.status === "ready" && download.filePath) {
    return localSource(download.filePath, playthrough);
  }

  const path =
    Platform.OS === "ios"
      ? playthrough.media.hlsPath
      : playthrough.media.mpdPath;

  return {
    url: path ? serverUrl(session.url, path) : "",
    // The type has to match the manifest: iOS is served HLS, everything else
    // DASH. Shipped code labelled both Dash, and AVPlayer tolerated it
    // (verified on device) because it identifies HLS from the response
    // itself — but nothing was relying on that tolerance, and a player that
    // believed the label would be handed a DASH parser for an m3u8.
    type: Platform.OS === "ios" ? TrackType.HLS : TrackType.Dash,
    artwork: playthrough.media.thumbnails
      ? serverUrl(session.url, playthrough.media.thumbnails.extraLarge)
      : undefined,
    headers: { Authorization: `Bearer ${session.token}` },
  };
}

/**
 * Play/Pause Event Consolidation
 *
 * Produces canonical play/pause events by consolidating two signals: our
 * play()/pause() functions and the `isPlaying` state changes (from TrackPlayer).
 *
 * This consolidation is necessary because play/pause can be triggered
 * externally (e.g. system interruptions, like RemoteDuck or a user manually
 * starting playback in another app) without going through our command
 * functions, especially on Android where the `RemoteDuck` TrackPlayer event is
 * currently broken.
 *
 * Deduplication strategy:
 * - play()/pause() set `awaitingIsPlayingMatch` BEFORE calling TrackPlayer
 * - play()/pause() emit the event directly after calling TrackPlayer
 * - When isPlaying changes, if it matches `awaitingIsPlayingMatch`, we skip
 *   (it's the result of our own command)
 * - If it doesn't match (or we're not awaiting), it's an external event and
 *   we emit immediately
 *
 * Consumers should subscribe to `lastPlayPause` in the track-player store for
 * the authoritative play/pause events.
 */

/**
 * Handle isPlaying state changes.
 *
 * When isPlaying changes and matches what we're awaiting from a command, we skip
 * (it's the result of our own command). Otherwise, it's an external event and we
 * emit immediately.
 */
function handleIsPlayingChanged(isPlaying: boolean) {
  const { progress, playthrough, playbackRate } = useTrackPlayer.getState();
  const direction: PlayPauseDirection = isPlaying ? "play" : "pause";

  log.debug(
    `isPlaying changed: ${direction} at ${progress.position.toFixed(3)} (awaiting=${awaitingIsPlayingMatch})`,
  );

  if (awaitingIsPlayingMatch === direction) {
    log.debug(`Skipping - matches awaited direction from command`);
    awaitingIsPlayingMatch = null;
    return;
  }

  // No playthrough loaded - nothing to record
  if (!playthrough) {
    return;
  }

  // External event - emit immediately
  emitPlayPauseEvent({
    direction,
    source: PlayPauseSource.EXTERNAL,
    timestamp: Date.now(),
    position: progress.position,
    playbackRate,
    playthroughId: playthrough.id,
  });
}

type EmitPlayPauseParams = {
  direction: PlayPauseDirection;
  source: PlayPauseSourceType;
  timestamp: number;
  position: number;
  playbackRate: number;
  playthroughId: string;
};

/**
 * Emit a canonical play/pause event to the store.
 */
function emitPlayPauseEvent(params: EmitPlayPauseParams) {
  log.info(
    `${params.direction} at ${params.position.toFixed(3)} (source: ${params.source})`,
  );

  useTrackPlayer.setState({
    lastPlayPause: {
      timestamp: params.timestamp,
      type:
        params.direction === "play" ? PlayPauseType.PLAY : PlayPauseType.PAUSE,
      source: params.source,
      playthroughId: params.playthroughId,
      position: params.position,
      playbackRate: params.playbackRate,
    },
  });
}

// Debug: Log state changes
useTrackPlayer.subscribe((state) => {
  log.silly(`State changed: ${JSON.stringify(state, null, 2)}`);
});

// =============================================================================
// Testing Helpers
// =============================================================================

/**
 * Reset all module-level state for testing.
 * This cleans up subscriptions and resets state to allow fresh initialization.
 */
export function resetForTesting() {
  // Reset module state
  awaitingIsPlayingMatch = null;

  // Unsubscribe from all subscriptions
  unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
  unsubscribeFunctions = [];

  // Reset store
  resetTrackPlayerStore();
}
