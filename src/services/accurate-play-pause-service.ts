import {
  PlayPauseCommand,
  PlayPauseType,
  useTrackPlayer,
} from "@/stores/track-player";
import { logBase } from "@/utils/logger";

let initialized = false;

const log = logBase.extend("accurate-play-pause-service");

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
  useTrackPlayer.subscribe((state, prevState) => {
    if (state.isPlaying.playing !== prevState.isPlaying.playing) {
      handleIsPlayingChanged(state.isPlaying.playing);
    }

    if (
      state.lastPlayPauseCommand &&
      state.lastPlayPauseCommand.timestamp !==
        prevState.lastPlayPauseCommand?.timestamp
    ) {
      handleLastPlayPauseCommandChanged(state.lastPlayPauseCommand);
    }
  });
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
