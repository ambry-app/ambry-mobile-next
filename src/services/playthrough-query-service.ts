/**
 * Playthrough Query Service
 *
 * Service layer for playthrough queries. This provides read-only access
 * to playthrough data for hooks and UI components.
 *
 * Note: This is separate from playthrough-lifecycle.ts which handles
 * loading/unloading playthroughs into the player.
 */

import {
  type ActivePlaythrough,
  getFinishedOrAbandonedPlaythrough as getFinishedOrAbandonedFromDb,
  getInProgressPlaythrough as getInProgressFromDb,
  getPlaythroughById as getPlaythroughByIdFromDb,
} from "@/db/playthroughs";
import { Session } from "@/types/session";

// Re-export types for consumers
export type { ActivePlaythrough };

// Derive type for finished/abandoned playthroughs
export type FinishedOrAbandonedPlaythrough = NonNullable<
  Awaited<ReturnType<typeof getFinishedOrAbandonedFromDb>>
>;

// Derive type for playthrough by ID
export type PlaythroughById = Awaited<
  ReturnType<typeof getPlaythroughByIdFromDb>
>;

/**
 * Gets the in-progress playthrough for a media item.
 * Returns undefined if no in-progress playthrough exists.
 *
 * @param session - The current user session
 * @param mediaId - The media ID to find playthrough for
 */
export async function getInProgressPlaythrough(
  session: Session,
  mediaId: string,
): Promise<ActivePlaythrough | undefined> {
  return getInProgressFromDb(session, mediaId);
}

/**
 * Gets the most recent finished or abandoned playthrough for a media item.
 * Returns undefined if no such playthrough exists.
 *
 * @param session - The current user session
 * @param mediaId - The media ID to find playthrough for
 */
export async function getFinishedOrAbandonedPlaythrough(
  session: Session,
  mediaId: string,
): Promise<FinishedOrAbandonedPlaythrough | undefined> {
  return getFinishedOrAbandonedFromDb(session, mediaId);
}

/**
 * Gets a playthrough by its ID.
 * Returns undefined if no playthrough with that ID exists.
 *
 * @param session - The current user session
 * @param playthroughId - The playthrough ID to fetch
 */
export async function getPlaythroughById(
  session: Session,
  playthroughId: string,
): Promise<PlaythroughById> {
  return getPlaythroughByIdFromDb(session, playthroughId);
}
