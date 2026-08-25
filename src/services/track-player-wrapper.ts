/**
 * Track Player Wrapper
 *
 * The seam between the app and whatever actually plays audio: today
 * `modules/audio-player` on both platforms (media3 on Android, AVQueuePlayer
 * on iOS). The API and event shapes are still react-native-track-player's -
 * every service above this line was written against them, and they live on
 * in `@/types/track-player` now that RNTP itself is gone.
 *
 * It is also where a recording's files stop being visible. A direct-play
 * recording can be one file or forty, but the player above this line only
 * ever sees one continuous book: `getProgress` reports book seconds and the
 * book's whole duration, and `seekTo` takes book seconds. Callers cannot
 * observe a track index because none is exposed, which is what keeps
 * multi-file out of the UI, the chapter logic and the event log by
 * construction rather than by everyone remembering to convert.
 *
 * And it is where remote transport arrives. The native module delivers
 * notification, lock-screen and media-key presses un-acted, and this file
 * re-emits them as the remote events the playback service already handles -
 * so a remote ±10s goes through the same rate-scaled seek path as an in-app
 * press, and a remote pause runs pause-rewind before the event log sees the
 * pause.
 */

import {
  getAudioPlayer,
  type NativeTrack,
  type PlayerSnapshot,
  type RemoteCommand,
} from "audio-player";

import type { AddTrack, PlaybackState, Progress } from "@/types/track-player";
import { Event, State, TrackType } from "@/types/track-player";
import { logBase } from "@/utils/logger";
import {
  bookDuration,
  bookPositionOf,
  type TimelineTrack,
  trackAt,
} from "@/utils/playback-timeline";

const log = logBase.extend("track-player-wrapper");

// The files behind the currently loaded recording, in playback order. Empty
// for legacy media, whose single stream is already the whole book, so the
// translation below collapses to a pass-through.
let timeline: TimelineTrack[] = [];

// =============================================================================
// Event dispatch
// =============================================================================

type Handler = (payload: any) => void;

const handlers = new Map<Event, Set<Handler>>();

function dispatch(event: Event, payload: unknown) {
  handlers.get(event)?.forEach((handler) => handler(payload));
}

export function addEventListener(event: Event, handler: Handler) {
  log.silly(`addEventListener ${event}`);

  // Registration is the first thing that happens at app start (entry.js), so
  // it is also where the native hookup belongs: nothing may be emitted before
  // someone could be listening.
  hookNativeEvents();

  let set = handlers.get(event);
  if (!set) {
    set = new Set();
    handlers.set(event, set);
  }
  set.add(handler);

  return {
    remove: () => {
      set.delete(handler);
    },
  };
}

/**
 * Map the player's snapshot onto RNTP's State, which is what
 * `determineIsPlaying` and the store were written against.
 */
function mapState(snapshot: PlayerSnapshot): State {
  switch (snapshot.state) {
    case "idle":
      return State.None;
    case "buffering":
      return State.Buffering;
    case "ended":
      return State.Ended;
    case "ready":
      return snapshot.playing ? State.Playing : State.Paused;
  }
}

let latestIndex = 0;
let previousState: State | null = null;
let previousPlayWhenReady: boolean | null = null;
let nativeEventsHooked = false;

function hookNativeEvents() {
  if (nativeEventsHooked) return;
  nativeEventsHooked = true;

  const native = getAudioPlayer();

  native.addListener("onStateChange", (snapshot) => {
    latestIndex = snapshot.index;

    const state = mapState(snapshot);
    if (state !== previousState) {
      previousState = state;
      dispatch(Event.PlaybackState, { state });
    }

    if (snapshot.playWhenReady !== previousPlayWhenReady) {
      previousPlayWhenReady = snapshot.playWhenReady;
      dispatch(Event.PlaybackPlayWhenReadyChanged, {
        playWhenReady: snapshot.playWhenReady,
      });
    }
  });

  native.addListener("onRemoteCommand", (command: RemoteCommand) => {
    log.debug(`remote command ${command.command}`);

    switch (command.command) {
      case "play":
        return dispatch(Event.RemotePlay, {});
      case "pause":
        return dispatch(Event.RemotePause, {});
      case "seekBack":
        return dispatch(Event.RemoteJumpBackward, {
          interval: command.intervalSeconds,
        });
      case "seekForward":
        return dispatch(Event.RemoteJumpForward, {
          interval: command.intervalSeconds,
        });
      case "seekTo":
        // The lock-screen seekbar hands us a position inside the current
        // file; the app's seek path speaks book seconds. An empty timeline is
        // legacy media, whose single stream already is the whole book.
        return dispatch(Event.RemoteSeek, {
          position:
            timeline.length === 0
              ? command.positionSeconds
              : bookPositionOf(
                  timeline,
                  command.index ?? latestIndex,
                  command.positionSeconds,
                ),
        });
    }
  });

  native.addListener("onQueueEnded", () => {
    dispatch(Event.PlaybackQueueEnded, {});
  });

  native.addListener("onError", ({ message }) => {
    log.error(`player error: ${message}`);
    dispatch(Event.PlaybackError, { message });
  });
}

// =============================================================================
// Playback Control
// =============================================================================

export async function play() {
  log.silly("play");
  return getAudioPlayer().play();
}

export async function pause() {
  log.silly("pause");
  return getAudioPlayer().pause();
}

/**
 * Seek to a position in book seconds.
 *
 * The native `seekTo` takes (file index, position) in one call, so crossing
 * into another file is the same operation as staying in this one and never
 * lands at the head of a file first.
 */
export async function seekTo(position: number) {
  log.silly(`seekTo ${position.toFixed(1)}`);

  const native = getAudioPlayer();

  if (timeline.length <= 1) {
    return native.seekTo(latestIndex, position);
  }

  const target = trackAt(timeline, position);
  return native.seekTo(target.index, target.position);
}

export async function setRate(rate: number) {
  log.silly(`setRate ${rate}`);
  return getAudioPlayer().setRate(rate);
}

export async function setVolume(volume: number) {
  log.silly(`setVolume ${volume}`);
  return getAudioPlayer().setVolume(volume);
}

// =============================================================================
// Queue Management
// =============================================================================

export async function reset() {
  log.silly("reset");
  timeline = [];
  return getAudioPlayer().reset();
}

/**
 * Load a recording's files as the player's queue.
 *
 * `tracks` describes where each file sits on the book's timeline. Pass an empty
 * array for legacy media, whose single stream already is the whole book.
 */
export async function add(tracks: AddTrack[], timelineTracks: TimelineTrack[]) {
  log.silly(`add ${tracks.length} file(s)`);
  timeline = timelineTracks;

  const nativeTracks: NativeTrack[] = tracks.map((track) => ({
    url: typeof track.url === "string" ? track.url : String(track.url),
    title: track.title,
    artist: track.artist,
    artwork: typeof track.artwork === "string" ? track.artwork : undefined,
    headers: track.headers as Record<string, string> | undefined,
    duration: track.duration,
    type:
      track.type === TrackType.Dash
        ? "dash"
        : track.type === TrackType.HLS
          ? "hls"
          : "default",
  }));

  return getAudioPlayer().setQueue(nativeTracks);
}

// =============================================================================
// State Queries
// =============================================================================

/**
 * Progress in book seconds, against the book's whole duration.
 *
 * The player reports where it is in the file it is playing. On a multi-file
 * recording that is neither the position the reader is at nor the length of
 * what they are listening to, so both are translated here.
 *
 * `buffered` is left as the player reports it: it describes the file being
 * streamed, and there is no meaningful book-wide equivalent.
 */
export async function getProgress(): Promise<Progress> {
  log.silly("getProgress");

  const snapshot = await getAudioPlayer().getState();
  latestIndex = snapshot.index;

  const progress: Progress = {
    position: snapshot.positionSeconds,
    duration: snapshot.durationSeconds,
    buffered: snapshot.bufferedSeconds,
  };

  if (timeline.length <= 1) return progress;

  // A player that reports no duration has lost its track — it errored, or a
  // streaming read failed — and everything it says is zeros. Callers detect
  // that by the zero duration and fall back to the last known position, so it
  // has to survive translation. Reporting the book's duration here regardless
  // would hide it, and a position of zero would translate into the start of
  // the current file: a plausible-looking number that would be recorded as a
  // seek the listener never made.
  if (progress.duration <= 0) return progress;

  return {
    ...progress,
    position: bookPositionOf(
      timeline,
      snapshot.index,
      snapshot.positionSeconds,
    ),
    duration: bookDuration(timeline),
  };
}

export async function getRate(): Promise<number> {
  log.silly("getRate");
  const snapshot = await getAudioPlayer().getState();
  return snapshot.rate;
}

export async function getPlaybackState(): Promise<PlaybackState> {
  log.silly("getPlaybackState");
  const snapshot = await getAudioPlayer().getState();
  return { state: mapState(snapshot) } as PlaybackState;
}

export async function getPlayWhenReady(): Promise<boolean> {
  log.silly("getPlayWhenReady");
  const snapshot = await getAudioPlayer().getState();
  return snapshot.playWhenReady;
}

// =============================================================================
// Setup
// =============================================================================

/**
 * Create the native player. Options are accepted for signature compatibility
 * with the RNTP call sites and ignored: the module configures itself.
 */
export async function setupPlayer(_options?: unknown) {
  log.silly("setupPlayer");
  hookNativeEvents();
  return getAudioPlayer().setup();
}

/**
 * RNTP needed to be told its capabilities and jump intervals; the module
 * fixes both natively (play/pause/±10s). Kept so call sites don't change.
 */
export async function updateOptions(_options?: unknown) {
  log.silly("updateOptions (no-op)");
}

/**
 * RNTP ran the factory in its headless task; there is no headless task any
 * more, so the listeners are simply registered now, in the one JS context.
 */
export function registerPlaybackService(
  factory: () => () => Promise<void>,
): void {
  log.silly("registerPlaybackService");
  void factory()();
}

// =============================================================================
// Testing
// =============================================================================

/**
 * Forget the loaded recording and the change-detection state between tests.
 * The handler registry is cleared too, because every test re-registers its
 * services; the native hookup itself is once-per-JS-context in production and
 * survives, which is why the test fake keeps its listener table across resets.
 */
export function resetForTesting() {
  timeline = [];
  latestIndex = 0;
  previousState = null;
  previousPlayWhenReady = null;
  handlers.clear();
}
