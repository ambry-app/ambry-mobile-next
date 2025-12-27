/**
 * Centralized playthrough lifecycle management.
 *
 * This service handles all playthrough state transitions (finish, abandon)
 * ensuring proper coordination between:
 * - Event recording (pause events, lifecycle events)
 * - Database status updates
 * - Player state (unloading if needed)
 * - UI notifications (data version bumping)
 *
 * All UI components should use these functions instead of directly calling
 * updatePlaythroughStatus for finish/abandon transitions.
 */

import { updatePlaythroughStatus } from "@/db/playthroughs";
import { bumpPlaythroughDataVersion } from "@/stores/data-version";
import { tryUnloadPlayer } from "@/stores/player";
import { Session } from "@/stores/session";

import {
  getCurrentPlaythroughId,
  pauseAndRecordEvent,
  recordAbandonEvent,
  recordFinishEvent,
} from "./event-recording-service";

export type FinishOptions = {
  /** Skip unloading the player (e.g., when loading new media immediately after) */
  skipUnload?: boolean;
};

/**
 * Mark a playthrough as finished.
 *
 * Handles all coordination:
 * 1. If this playthrough is loaded in player and playing, pauses and records pause event
 * 2. Records "finish" lifecycle event
 * 3. Updates playthrough status in database
 * 4. Bumps data version to notify UI
 * 5. Unloads player if this playthrough was loaded (unless skipUnload is true)
 */
export async function finishPlaythrough(
  session: Session,
  playthroughId: string,
  options?: FinishOptions,
) {
  const isLoadedInPlayer = getCurrentPlaythroughId() === playthroughId;

  // If this playthrough is loaded, pause if playing and record the event
  // (pauseAndRecordEvent checks isPlaying internally, skips if already paused)
  if (isLoadedInPlayer) {
    await pauseAndRecordEvent();
  }

  // Record the finish lifecycle event
  await recordFinishEvent(playthroughId);

  // Update status in database
  await updatePlaythroughStatus(session, playthroughId, "finished", {
    finishedAt: new Date(),
  });

  // Notify UI that playthrough data changed
  bumpPlaythroughDataVersion();

  // Unload player if this playthrough was loaded (unless caller wants to handle it)
  if (isLoadedInPlayer && !options?.skipUnload) {
    await tryUnloadPlayer();
  }
}

/**
 * Mark a playthrough as abandoned.
 *
 * Handles all coordination:
 * 1. If this playthrough is loaded in player and playing, pauses and records pause event
 * 2. Records "abandon" lifecycle event
 * 3. Updates playthrough status in database
 * 4. Bumps data version to notify UI
 * 5. Unloads player if this playthrough was loaded
 */
export async function abandonPlaythrough(
  session: Session,
  playthroughId: string,
) {
  const isLoadedInPlayer = getCurrentPlaythroughId() === playthroughId;

  // If this playthrough is loaded, pause if playing and record the event
  // (pauseAndRecordEvent checks isPlaying internally, skips if already paused)
  if (isLoadedInPlayer) {
    await pauseAndRecordEvent();
  }

  // Record the abandon lifecycle event
  await recordAbandonEvent(playthroughId);

  // Update status in database
  await updatePlaythroughStatus(session, playthroughId, "abandoned", {
    abandonedAt: new Date(),
  });

  // Notify UI that playthrough data changed
  bumpPlaythroughDataVersion();

  // Unload player if this playthrough was loaded
  if (isLoadedInPlayer) {
    await tryUnloadPlayer();
  }
}
