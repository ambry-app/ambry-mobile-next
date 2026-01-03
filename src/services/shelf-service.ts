/**
 * Shelf Service
 *
 * Service layer for shelf operations. Handles adding/removing media
 * to/from user shelves (e.g., "saved for later").
 */

import { useCallback, useEffect, useState } from "react";

import {
  isMediaOnShelf as isMediaOnShelfDb,
  toggleMediaOnShelf as toggleMediaOnShelfDb,
} from "@/db/shelves";
import { bumpShelfDataVersion } from "@/stores/data-version";
import { Session } from "@/types/session";

// Re-export shelf queries and types for UI consumers
export { getSavedMediaPage, type SavedMediaWithDetails } from "@/db/shelves";

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

// =============================================================================
// Shelf Hooks
// =============================================================================

/**
 * Hook to manage a media item's presence on a shelf.
 * Provides current status and toggle function.
 *
 * @param session - The current user session
 * @param mediaId - The media ID to check/toggle
 * @param shelfName - The shelf name (e.g., "saved")
 */
export function useShelvedMedia(
  session: Session,
  mediaId: string,
  shelfName: string,
) {
  const [isOnShelf, setIsOnShelf] = useState<boolean>(false);

  const load = useCallback(async () => {
    setIsOnShelf(await isMediaOnShelf(session, mediaId, shelfName));
  }, [session, mediaId, shelfName]);

  const toggleOnShelf = useCallback(async () => {
    await toggleMediaOnShelf(session, mediaId, shelfName);
    await load();
    bumpShelfDataVersion();
  }, [session, mediaId, shelfName, load]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isOnShelf, toggleOnShelf };
}
