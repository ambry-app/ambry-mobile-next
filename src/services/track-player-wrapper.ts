/**
 * Track Player Wrapper
 *
 * The seam between the app and `modules/audio-player` (media3 on Android,
 * AVQueuePlayer on iOS) - the only file that talks to the native module.
 *
 * It is where a recording's files stop being visible. A direct-play recording
 * can be one file or forty, but above this line there is only one continuous
 * book: progress is book seconds against the book's whole duration, `seekTo`
 * takes book seconds, and no track index is exposed - which keeps multi-file
 * out of the UI, the chapter logic and the event log by construction.
 *
 * It is also where remote transport arrives. The native module delivers
 * notification, lock-screen and media-key presses un-acted; they are
 * re-emitted here (seek positions translated to book seconds) so a remote
 * ±10s goes through the same rate-scaled path as an in-app press, and a
 * remote pause runs pause-rewind before the event log sees the pause.
 *
 * Reads are synchronous. The module pushes a full snapshot on every
 * discontinuity and once a second while playing, and the latest one is
 * mirrored here - so `getProgress` and friends cost no native round trip.
 * Commands stay async; a `seekTo` resolves once the seek has applied.
 */

import {
  getAudioPlayer,
  type NativeTrack,
  type PlayerSnapshot,
  type RemoteCommand,
} from "audio-player";

import type { AddTrack, PlayerState, Progress } from "@/types/track-player";
import { TrackType } from "@/types/track-player";
import { logBase } from "@/utils/logger";
import {
  bookDuration,
  bookPositionOf,
  type TimelineTrack,
  trackAt,
} from "@/utils/playback-timeline";

const log = logBase.extend("track-player-wrapper");

// The module's state vocabulary and the app's are the same words; this line
// fails to compile if they ever drift.
const _stateCheck: PlayerState = "idle" as PlayerSnapshot["state"];
void _stateCheck;

export type { PlayerState };

/** The player's whole observable state, in book coordinates. */
export type BookSnapshot = {
  state: PlayerState;
  playing: boolean;
  playWhenReady: boolean;
  rate: number;
  progress: Progress;
};

/** A remote press, un-acted, with seek positions already in book seconds. */
export type RemoteTransport =
  | { command: "play" }
  | { command: "pause" }
  | { command: "seekBack"; intervalSeconds: number }
  | { command: "seekForward"; intervalSeconds: number }
  | { command: "seekTo"; positionSeconds: number };

// The files behind the currently loaded recording, in playback order. Empty
// for legacy media, whose single stream is already the whole book, so the
// translation below collapses to a pass-through.
let timeline: TimelineTrack[] = [];

const idleSnapshot: PlayerSnapshot = {
  state: "idle",
  playing: false,
  playWhenReady: false,
  index: 0,
  positionSeconds: 0,
  durationSeconds: 0,
  bufferedSeconds: 0,
  rate: 1,
};

let mirror: PlayerSnapshot = idleSnapshot;

// When the mirror was last written. While audio is running, position reads
// extrapolate from here at the playback rate - the same continuity the iOS
// lock screen shows - so a read is accurate at any moment, not just on the
// second.
let mirrorAt = 0;

function setMirror(next: PlayerSnapshot) {
  mirror = next;
  mirrorAt = Date.now();
}

// =============================================================================
// Subscriptions
// =============================================================================

type Listener<T> = (payload: T) => void;

const snapshotListeners = new Set<Listener<BookSnapshot>>();
const remoteListeners = new Set<Listener<RemoteTransport>>();
const queueEndedListeners = new Set<Listener<void>>();
const errorListeners = new Set<Listener<string>>();

function subscribe<T>(listeners: Set<Listener<T>>, listener: Listener<T>) {
  // Subscribing is the first thing that happens at app start, so it is also
  // where the native hookup belongs: nothing may be emitted before someone
  // could be listening.
  hookNativeEvents();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function onSnapshot(listener: Listener<BookSnapshot>) {
  return subscribe(snapshotListeners, listener);
}

export function onRemoteCommand(listener: Listener<RemoteTransport>) {
  return subscribe(remoteListeners, listener);
}

export function onQueueEnded(listener: Listener<void>) {
  return subscribe(queueEndedListeners, listener);
}

export function onError(listener: Listener<string>) {
  return subscribe(errorListeners, listener);
}

let nativeEventsHooked = false;

function hookNativeEvents() {
  if (nativeEventsHooked) return;
  nativeEventsHooked = true;

  const native = getAudioPlayer();

  native.addListener("onStateChange", (snapshot) => {
    setMirror(snapshot);
    emitSnapshot();
  });

  native.addListener("onRemoteCommand", (command: RemoteCommand) => {
    log.debug(`remote command ${command.command}`);
    remoteListeners.forEach((listener) => listener(translateRemote(command)));
  });

  native.addListener("onQueueEnded", () => {
    queueEndedListeners.forEach((listener) => listener());
  });

  native.addListener("onError", ({ message }) => {
    log.error(`player error: ${message}`);
    errorListeners.forEach((listener) => listener(message));
  });

  // Seed the mirror, so a hot reload against a live player starts truthful.
  void native.getState().then((snapshot) => {
    setMirror(snapshot);
    emitSnapshot();
  });
}

function emitSnapshot() {
  const snapshot = getSnapshot();
  snapshotListeners.forEach((listener) => listener(snapshot));
}

/**
 * The lock-screen seekbar hands us a position inside the current file; the
 * app's seek path speaks book seconds. An empty timeline is legacy media,
 * whose single stream already is the whole book.
 */
function translateRemote(command: RemoteCommand): RemoteTransport {
  if (command.command !== "seekTo") return command;
  return {
    command: "seekTo",
    positionSeconds:
      timeline.length === 0
        ? command.positionSeconds
        : bookPositionOf(
            timeline,
            command.index ?? mirror.index,
            command.positionSeconds,
          ),
  };
}

// =============================================================================
// State (synchronous, from the mirror)
// =============================================================================

/**
 * Progress in book seconds, against the book's whole duration.
 *
 * A player that reports no duration has lost its track - it errored, or a
 * streaming read failed - and everything it says is zeros. Callers detect
 * that by the zero duration and fall back to the last known position, so it
 * has to survive translation: a position of zero translated onto the current
 * file would be a plausible-looking number recorded as a seek the listener
 * never made.
 */
export function getProgress(): Progress {
  const elapsed = mirror.playing ? (Date.now() - mirrorAt) / 1000 : 0;
  const position = Math.min(
    mirror.positionSeconds + elapsed * mirror.rate,
    mirror.durationSeconds > 0 ? mirror.durationSeconds : Infinity,
  );
  const progress = {
    position,
    duration: mirror.durationSeconds,
    buffered: mirror.bufferedSeconds,
  };

  if (timeline.length <= 1) return progress;
  if (progress.duration <= 0) return progress;

  return {
    ...progress,
    position: bookPositionOf(timeline, mirror.index, position),
    duration: bookDuration(timeline),
  };
}

export function getRate(): number {
  return mirror.rate;
}

export function getPlayWhenReady(): boolean {
  return mirror.playWhenReady;
}

export function getState(): PlayerState {
  return mirror.state;
}

export function getSnapshot(): BookSnapshot {
  return {
    state: mirror.state,
    playing: mirror.playing,
    playWhenReady: mirror.playWhenReady,
    rate: mirror.rate,
    progress: getProgress(),
  };
}

// =============================================================================
// Commands
// =============================================================================
// Each command patches the mirror with what it just asked for, so a
// synchronous read immediately after the await agrees with the command - the
// confirming native snapshot arrives a beat later.

export async function play() {
  log.silly("play");
  await getAudioPlayer().play();
  setMirror({ ...mirror, playWhenReady: true });
}

export async function pause() {
  log.silly("pause");
  await getAudioPlayer().pause();
  setMirror({ ...mirror, playWhenReady: false, playing: false });
}

/**
 * Seek to a position in book seconds.
 *
 * The native `seekTo` takes (file index, position) in one call, so crossing
 * into another file is the same operation as staying in this one and never
 * lands at the head of a file first. It resolves once the seek has applied.
 */
export async function seekTo(position: number) {
  log.silly(`seekTo ${position.toFixed(1)}`);

  const target =
    timeline.length <= 1
      ? { index: mirror.index, position }
      : trackAt(timeline, position);

  await getAudioPlayer().seekTo(target.index, target.position);
  setMirror({
    ...mirror,
    index: target.index,
    positionSeconds: target.position,
  });
}

export async function setRate(rate: number) {
  log.silly(`setRate ${rate}`);
  await getAudioPlayer().setRate(rate);
  setMirror({ ...mirror, rate });
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
  setMirror(idleSnapshot);
  return getAudioPlayer().reset();
}

/**
 * Load a recording's files as the player's queue.
 *
 * `tracks` describes where each file sits on the book's timeline. Pass an
 * empty array for legacy media, whose single stream already is the whole
 * book. The player derives its duration from the media, so a single-file
 * queue reports duration 0 until it has buffered - see
 * `waitForValidProgress` in track-player-service.
 */
export async function add(tracks: AddTrack[], timelineTracks: TimelineTrack[]) {
  log.silly(`add ${tracks.length} file(s)`);
  timeline = timelineTracks;

  const nativeTracks: NativeTrack[] = tracks.map((track) => ({
    url: track.url,
    title: track.title,
    artist: track.artist,
    artwork: track.artwork,
    headers: track.headers,
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
// Setup
// =============================================================================

export async function setupPlayer() {
  log.silly("setupPlayer");
  hookNativeEvents();
  return getAudioPlayer().setup();
}

// =============================================================================
// Testing
// =============================================================================

/**
 * Forget the loaded recording, the mirror and every listener between tests.
 * The native hookup itself is once-per-JS-context in production and survives,
 * which is why the test fake keeps its listener table across resets.
 */
export function resetForTesting() {
  timeline = [];
  mirror = idleSnapshot;
  mirrorAt = 0;
  snapshotListeners.clear();
  remoteListeners.clear();
  queueEndedListeners.clear();
  errorListeners.clear();
}
