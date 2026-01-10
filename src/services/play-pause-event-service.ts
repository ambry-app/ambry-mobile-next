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

type PendingFallback = {
  direction: "play" | "pause";
  timestamp: number;
  position: number;
  timer: NodeJS.Timeout;
};

let pendingFallback: PendingFallback | null = null;

// =============================================================================
// Public API
// =============================================================================

/**
 * Initialize the accurate play-pause service.
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
  const direction = isPlaying ? "play" : "pause";
  const timestamp = Date.now();
  const position = useTrackPlayer.getState().progress.position;

  log.debug(`isPlaying changed: ${direction} at ${position}`);

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
  const direction = command.type === PlayPauseType.PLAY ? "play" : "pause";

  log.debug(`lastPlayPauseCommand changed: ${direction}`);

  const hadPendingFallback = pendingFallback !== null;

  if (pendingFallback?.timer) {
    clearTimeout(pendingFallback.timer);
    pendingFallback = null;
  }

  emit({
    direction,
    timestamp: command.timestamp,
    position: command.at,
    source: "command",
    hadPendingFallback,
  });
}

function onFallbackTimeout() {
  if (!pendingFallback) {
    log.warn("Fallback timeout fired but no pending fallback");
    return;
  }

  const { direction, timestamp, position } = pendingFallback;

  pendingFallback = null;

  emit({
    direction,
    timestamp,
    position,
    source: "fallback",
    hadPendingFallback: true,
  });
}

type EmitParams = {
  direction: "play" | "pause";
  timestamp: number;
  position: number;
  source: "command" | "fallback";
  hadPendingFallback: boolean;
};

function emit(params: EmitParams) {
  log.info(
    `Emitting play/pause event: ${params.direction} at ${params.position} from ${params.source}`,
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
