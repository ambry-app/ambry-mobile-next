/**
 * Playthrough Lifecycle Service
 *
 * Handles the finalization of playthroughs (finish/abandon).
 * This is the SINGLE source of truth for:
 * - Recording lifecycle events (finish, abandon)
 * - Updating playthrough status in DB
 * - Clearing active playthrough for device
 * - Bumping data version for UI refresh
 * - Triggering sync
 *
 * Called from:
 * - playthrough-transitions.ts (user-initiated finish/abandon)
 * - event-recording-service.ts (auto-finish on queue ended)
 *
 * NOTE: This service does NOT handle pausing or recording pause events.
 * Callers are responsible for pausing playback and recording pause events
 * before calling these functions.
 */

import {
  clearActivePlaythroughIdForDevice,
  updatePlaythroughStatus,
} from "@/db/playthroughs";
import { syncPlaythroughs } from "@/db/sync";
import { bumpPlaythroughDataVersion } from "@/stores/data-version";
import { Session, useSession } from "@/stores/session";

import {
  recordAbandonEvent,
  recordFinishEvent,
} from "./event-recording-service";

// =============================================================================
// Public API
// =============================================================================

/**
 * Finalize a playthrough as finished.
 *
 * This handles all the bookkeeping for marking a playthrough complete:
 * 1. Records "finish" lifecycle event
 * 2. Updates playthrough status in database
 * 3. Clears active playthrough for this device
 * 4. Bumps data version for UI refresh
 * 5. Triggers sync in background
 *
 * @param session - Current session (or null to use current session from store)
 * @param playthroughId - ID of the playthrough to finish
 */
export async function finishPlaythrough(
  session: Session | null,
  playthroughId: string,
): Promise<void> {
  const resolvedSession = session ?? useSession.getState().session;
  if (!resolvedSession) {
    console.warn("[Lifecycle] No session, cannot finish playthrough");
    return;
  }

  console.debug("[Lifecycle] Finishing playthrough:", playthroughId);

  // Record the finish lifecycle event
  await recordFinishEvent(playthroughId);

  // Update status in database
  await updatePlaythroughStatus(resolvedSession, playthroughId, "finished", {
    finishedAt: new Date(),
  });

  // Clear the active playthrough for this device since it's finished
  await clearActivePlaythroughIdForDevice(resolvedSession);

  // Notify UI that playthrough data changed
  bumpPlaythroughDataVersion();

  // Trigger sync in background (non-blocking)
  triggerBackgroundSync(resolvedSession);
}

/**
 * Finalize a playthrough as abandoned.
 *
 * This handles all the bookkeeping for marking a playthrough abandoned:
 * 1. Records "abandon" lifecycle event
 * 2. Updates playthrough status in database
 * 3. Clears active playthrough for this device
 * 4. Bumps data version for UI refresh
 * 5. Triggers sync in background
 *
 * @param session - Current session (or null to use current session from store)
 * @param playthroughId - ID of the playthrough to abandon
 */
export async function abandonPlaythrough(
  session: Session | null,
  playthroughId: string,
): Promise<void> {
  const resolvedSession = session ?? useSession.getState().session;
  if (!resolvedSession) {
    console.warn("[Lifecycle] No session, cannot abandon playthrough");
    return;
  }

  console.debug("[Lifecycle] Abandoning playthrough:", playthroughId);

  // Record the abandon lifecycle event
  await recordAbandonEvent(playthroughId);

  // Update status in database
  await updatePlaythroughStatus(resolvedSession, playthroughId, "abandoned", {
    abandonedAt: new Date(),
  });

  // Clear the active playthrough for this device since it's abandoned
  await clearActivePlaythroughIdForDevice(resolvedSession);

  // Notify UI that playthrough data changed
  bumpPlaythroughDataVersion();

  // Trigger sync in background (non-blocking)
  triggerBackgroundSync(resolvedSession);
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Trigger a sync in the background without blocking.
 */
function triggerBackgroundSync(session: Session) {
  syncPlaythroughs(session).catch((error) => {
    console.warn("[Lifecycle] Background sync failed:", error);
  });
}
