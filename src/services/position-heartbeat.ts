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
import {
  PlayPauseEvent,
  PlayPauseSource,
  PlayPauseType,
  useTrackPlayer,
} from "@/stores/track-player";
import { logBase } from "@/utils/logger";
import { subscribeToChange } from "@/utils/subscribe";

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
  subscribeToChange(
    useTrackPlayer,
    (s) => s.lastPlayPause,
    (event) => event && handlePlayPauseEvent(event),
  );
}

/**
 * Handle play/pause events. Starts or stops the heartbeat accordingly.
 * Ignores INTERNAL events (e.g., during reload) to avoid unnecessary restarts.
 */
function handlePlayPauseEvent(event: PlayPauseEvent) {
  if (event.source === PlayPauseSource.INTERNAL) {
    log.debug("Ignoring INTERNAL play/pause event");
    return;
  }

  if (event.type === PlayPauseType.PLAY) {
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
 *
 * V2: Cache only stores position for crash recovery. Rate and other state
 * live on the playthrough itself (derived from events).
 */
async function save(): Promise<void> {
  const currentPlaythroughId = Player.getLoadedPlaythrough()?.id;
  if (!currentPlaythroughId) return;

  const { position } = Player.getProgress();

  // Only save position - rate lives on playthrough, not cache
  await updateStateCache(currentPlaythroughId, position);

  log.info(`Saved position: ${position.toFixed(1)}`);
}
