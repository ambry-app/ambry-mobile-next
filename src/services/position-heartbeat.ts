/**
 * Position Heartbeat Service
 *
 * Manages periodic saving of playback position to the state cache. This runs
 * during playback to ensure position is saved even if the app crashes or is
 * force-killed.
 */

import { PROGRESS_SAVE_INTERVAL } from "@/constants";
import { updateStateCache } from "@/db/playthroughs";
import * as Player from "@/services/track-player-service";
import { useTrackPlayer } from "@/stores/track-player";
import { logBase } from "@/utils/logger";

const log = logBase.extend("position-heartbeat");

let initialized = false;
let heartbeatInterval: NodeJS.Timeout | null = null;

// =============================================================================
// Public API
// =============================================================================

/**
 * Initialize the heartbeat service.
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

// FIXME: maybe?
/**
 * Force an immediate save of the current playback position.
 * Call this before reloading the player to preserve position.
 */
export async function saveNow(): Promise<void> {
  await save();
}

// =============================================================================
// Internal
// =============================================================================

/**
 * Subscribes to the track-player store to reactively start and stop the
 * heartbeat based on playback state changes.
 */
function setupStoreSubscriptions() {
  useTrackPlayer.subscribe((state, prevState) => {
    if (state.isPlaying.playing !== prevState.isPlaying.playing) {
      handleIsPlayingChange(state.isPlaying.playing);
    }
  });
}

/**
 * Handle changes to isPlaying state. Starts or stops the heartbeat accordingly.
 */
function handleIsPlayingChange(isPlaying: boolean) {
  if (isPlaying) {
    start();
  } else {
    stop();
  }
}

/**
 * Start the position heartbeat.
 */
function start(): void {
  if (heartbeatInterval) {
    return;
  }

  heartbeatInterval = setInterval(async () => {
    await save();
  }, PROGRESS_SAVE_INTERVAL);

  log.debug("Started heartbeat");
}

/**
 * Stop the position heartbeat.
 */
function stop(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    log.debug("Stopped heartbeat");
  }
}

/**
 * Save the current playback position to the state cache.
 */
async function save(): Promise<void> {
  const currentPlaythroughId = Player.getLoadedPlaythrough()?.id;
  if (!currentPlaythroughId) return;

  const currentPlaybackRate = Player.getPlaybackRate();
  const { position } = Player.getProgress();

  await updateStateCache(currentPlaythroughId, position, currentPlaybackRate);

  log.debug(`Saved position: ${position.toFixed(1)}`);
}
