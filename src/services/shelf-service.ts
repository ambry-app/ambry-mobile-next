/**
 * Shelf Service
 *
 * Service layer for shelf operations. Handles adding/removing media
 * to/from user shelves (e.g., "saved for later").
 */

import {
  isMediaOnShelf as isMediaOnShelfDb,
  toggleMediaOnShelf as toggleMediaOnShelfDb,
} from "@/db/shelves";
import { Session } from "@/types/session";

/**
 * Checks if a media item is on a specific shelf.
 *
 * @param session - The current user session
 * @param mediaId - The media ID to check
 * @param shelfName - The shelf name (e.g., "saved")
 * @returns true if the media is on the shelf, false otherwise
 */
export async function isMediaOnShelf(
  session: Session,
  mediaId: string,
  shelfName: string,
): Promise<boolean> {
  return isMediaOnShelfDb(session, mediaId, shelfName);
}

/**
 * Toggles a media item on/off a specific shelf.
 * If the media is on the shelf, removes it. If not, adds it.
 *
 * @param session - The current user session
 * @param mediaId - The media ID to toggle
 * @param shelfName - The shelf name (e.g., "saved")
 */
export async function toggleMediaOnShelf(
  session: Session,
  mediaId: string,
  shelfName: string,
): Promise<void> {
  await toggleMediaOnShelfDb(session, mediaId, shelfName);
}
