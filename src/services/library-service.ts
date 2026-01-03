/**
 * Library Service
 *
 * Service layer for library data queries. This provides a clean interface
 * between hooks/UI and the database layer.
 *
 * Note: This service will grow significantly as more library queries
 * are moved here from direct db imports.
 */

import {
  type DownloadedMedia,
  getDownloadedMedia as getDownloadedMediaFromDb,
} from "@/db/library";
import { Session } from "@/types/session";

// Re-export types for consumers
export type { DownloadedMedia };

/**
 * Gets media items that have been downloaded locally.
 *
 * @param session - The current user session
 * @param mediaIds - Array of media IDs to fetch
 * @returns Array of downloaded media with book, author, narrator, and playthrough info
 */
export async function getDownloadedMedia(
  session: Session,
  mediaIds: string[],
): Promise<DownloadedMedia[]> {
  return getDownloadedMediaFromDb(session, mediaIds);
}
