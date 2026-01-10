/**
 * Play/Pause Event Service
 *
 * Produces canonical play/pause events by consolidating two signals: the
 * `lastPlayPauseCommand` (when we tell TrackPlayer to play/pause) and the
 * `isPlaying` state (when playback actually starts/stops).
 *
 * This consolidation is necessary because play/pause can be triggered
 * externally (e.g. system interruptions, like RemoteDuck or a user manually
 * starting playback in another app) without going through our command
 * functions, especially on Android where the `RemoteDuck` TrackPlayer event is
 * currently broken. The service prefers command timing when available, falling
 * back to state change detection otherwise.
 *
 * Deduplication strategy:
 * - When we emit from a command, we record the direction (play/pause)
 * - When isPlaying changes, if it matches the direction we're awaiting, we skip
 *   (it's the result of our own command)
 * - If it doesn't match (or we're not awaiting), it's an external event
 *
 * Consumers should subscribe to `lastPlayPause` in the track-player store for
 * the authoritative play/pause events.
 */

import {
  PlayPauseCommand,
  PlayPauseType,
  useTrackPlayer,
} from "@/stores/track-player";
import { logBase } from "@/utils/logger";
import { subscribeToChange } from "@/utils/subscribe";

let initialized = false;

const log = logBase.extend("play-pause-event-service");

const FALLBACK_TIMEOUT_MS = 50;

type Direction = "play" | "pause";

type PendingFallback = {
  direction: Direction;
  timestamp: number;
  position: number;
  timer: NodeJS.Timeout;
};

let pendingFallback: PendingFallback | null = null;

let awaitingIsPlayingMatch: Direction | null = null;

// =============================================================================
// Public API
// =============================================================================

/**
 * Initialize the play-pause event service.
 */
export async function initialize() {
  if (initialized) {
    log.debug("Already initialized, skipping");
    return;
  }

  setupStoreSubscriptions();
  initialized = true;

  log.debug("Initialized");
}

// =============================================================================
// Internals
// =============================================================================

function setupStoreSubscriptions() {
  subscribeToChange(
    useTrackPlayer,
    (s) => s.isPlaying.playing,
    handleIsPlayingChanged,
  );

  subscribeToChange(
    useTrackPlayer,
    (s) => s.lastPlayPauseCommand,
    (command) => command && handleLastPlayPauseCommandChanged(command),
  );
}

function handleIsPlayingChanged(isPlaying: boolean) {
  const direction: Direction = isPlaying ? "play" : "pause";
  const timestamp = Date.now();
  const position = useTrackPlayer.getState().progress.position;

  log.debug(
    `isPlaying changed: ${direction} at ${position.toFixed(3)} (awaiting=${awaitingIsPlayingMatch})`,
  );

  if (awaitingIsPlayingMatch === direction) {
    log.debug(`Skipping - matches awaited direction from command`);
    awaitingIsPlayingMatch = null;
    return;
  }

  // State changed to a different direction than awaited (or not awaiting at all)
  // This could be:
  // 1. An external event (RemoteDuck, etc.) - no command will come
  // 2. isPlaying changed BEFORE our command arrived - command will come shortly
  // Start a fallback timer to handle case 1, which will be cancelled if case 2

  if (pendingFallback?.timer) {
    clearTimeout(pendingFallback.timer);
  }

  const timer = setTimeout(() => onFallbackTimeout(), FALLBACK_TIMEOUT_MS);

  pendingFallback = {
    direction,
    timestamp,
    position,
    timer,
  };
}

function handleLastPlayPauseCommandChanged(command: PlayPauseCommand) {
  const direction: Direction =
    command.type === PlayPauseType.PLAY ? "play" : "pause";

  log.debug(`lastPlayPauseCommand changed: ${direction}`);

  if (pendingFallback?.timer) {
    clearTimeout(pendingFallback.timer);
    pendingFallback = null;
  }

  awaitingIsPlayingMatch = direction;

  emit({
    direction,
    timestamp: command.timestamp,
    position: command.at,
    source: "command",
  });
}

function onFallbackTimeout() {
  if (!pendingFallback) {
    log.warn("Fallback timeout fired but no pending fallback");
    return;
  }

  const { direction, timestamp, position } = pendingFallback;

  pendingFallback = null;
  awaitingIsPlayingMatch = null;

  emit({
    direction,
    timestamp,
    position,
    source: "fallback",
  });
}

type EmitParams = {
  direction: Direction;
  timestamp: number;
  position: number;
  source: "command" | "fallback";
};

function emit(params: EmitParams) {
  log.info(
    `Emitting play/pause event: ${params.direction} at ${params.position.toFixed(3)} from ${params.source}`,
  );

  useTrackPlayer.setState({
    lastPlayPause: {
      timestamp: params.timestamp,
      type:
        params.direction === "play" ? PlayPauseType.PLAY : PlayPauseType.PAUSE,
      position: params.position,
    },
  });
}
