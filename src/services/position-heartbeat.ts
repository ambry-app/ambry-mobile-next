/**
 * Position Heartbeat Service
 *
 * Manages periodic saving of playback position to the state cache. This runs
 * during playback to ensure position is saved even if the app crashes or is
 * force-killed.
 */

import * as BackgroundTimer from "background-timer";

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

/**
 * A background timer, not `setInterval`: the position this saves is the one
 * that survives a crash, and the listening it needs to protect is mostly done
 * with the app backgrounded, where JS timers do not tick. See
 * `modules/background-timer`.
 */
let heartbeatInterval: BackgroundTimer.BackgroundTimerHandle | null = null;

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

  heartbeatInterval = BackgroundTimer.scheduleInterval(() => {
    // A tick that fails is a tick: the next one is 30 seconds away, and the
    // save now asks the player, which can reject where reading the store
    // could not.
    save().catch((error) => log.error("Position save failed", error));
  }, PROGRESS_SAVE_INTERVAL);

  log.debug("Started heartbeat");
}

/**
 * Stop the position heartbeat.
 */
function stop(): void {
  if (heartbeatInterval) {
    BackgroundTimer.cancel(heartbeatInterval);
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

  // Ask the player, not the store. The store's progress is written by a poll
  // that only runs while the app is on screen, so a heartbeat firing in the
  // background would otherwise persist whatever position was current when the
  // screen went off - observed writing 60.0 while the player was at 551.9.
  const { position, duration } = await Player.getAccurateProgress();

  // A zeroed duration means progress came from a player that lost its track
  // (or one that hasn't loaded yet). Never overwrite a good cached position
  // with that.
  if (duration <= 0) {
    log.warn("Skipping position save - progress is invalid (duration is 0)");
    return;
  }

  // Only save position - rate lives on playthrough, not cache
  await updateStateCache(currentPlaythroughId, position);

  log.info(`Saved position: ${position.toFixed(1)}`);
}
