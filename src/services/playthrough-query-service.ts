/**
 * Playthrough Query Service
 *
 * Service layer for playthrough queries. This provides read-only access
 * to playthrough data for hooks and UI components.
 *
 * Note: This is separate from playthrough-lifecycle.ts which handles
 * loading/unloading playthroughs into the player.
 */

import { useEffect, useState } from "react";

import { FINISH_PROMPT_THRESHOLD } from "@/constants";
import {
  type ActivePlaythrough,
  getFinishedOrAbandonedPlaythrough as getFinishedOrAbandonedFromDb,
  getInProgressPlaythrough as getInProgressFromDb,
  getPlaythroughById as getPlaythroughByIdFromDb,
} from "@/db/playthroughs";
import { useDataVersion } from "@/stores/data-version";
import { usePlayerUIState } from "@/stores/player-ui-state";
import { useSession } from "@/stores/session";
import { Session } from "@/types/session";

import { useLibraryData } from "./library-service";
import { useIsPlaying } from "./trackplayer-wrapper";

// Re-export types and functions for UI consumers
export type { ActivePlaythrough };
export {
  getAllPlaythroughsForMedia,
  type PlaythroughForMedia,
} from "@/db/playthroughs";

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

// =============================================================================
// Playthrough Hooks
// =============================================================================

/**
 * Discriminated union representing the playback state for a specific media.
 *
 * - `loading`: Initial state while querying the database
 * - `loaded`: This media is currently in the player
 * - `in_progress`: Has an in-progress playthrough (not currently loaded)
 * - `finished`: Most recent playthrough was finished
 * - `abandoned`: Most recent playthrough was abandoned
 * - `none`: No playthrough exists for this media
 */
export type MediaPlaybackState =
  | { type: "loading" }
  | { type: "loaded"; isPlaying: boolean; playthrough: { id: string } }
  | { type: "in_progress"; playthrough: ActivePlaythrough }
  | { type: "finished"; playthrough: FinishedOrAbandonedPlaythrough }
  | { type: "abandoned"; playthrough: FinishedOrAbandonedPlaythrough }
  | { type: "none" };

/**
 * Hook to get the playback state for a specific media.
 *
 * This hook provides a single source of truth for "what's the playback state
 * of this media?" It handles:
 * 1. Checking if the media is currently loaded in the player
 * 2. Querying the database for playthrough state if not loaded
 * 3. Automatically refreshing when playthrough data changes
 *
 * @example
 * ```tsx
 * const state = useMediaPlaybackState(session, media.id);
 *
 * switch (state.type) {
 *   case 'loading':
 *     return <Spinner />;
 *   case 'loaded':
 *     return <PlayerPlayPauseButton />;
 *   case 'in_progress':
 *     return <Button onPress={() => continuePlaythrough(session, state.playthrough.id)} />;
 *   case 'finished':
 *   case 'abandoned':
 *     return <Button onPress={() => showResumePrompt(state.playthrough)} />;
 *   case 'none':
 *     return <Button onPress={() => startNewPlaythrough(session, mediaId)} />;
 * }
 * ```
 */
export function useMediaPlaybackState(
  session: Session,
  mediaId: string,
): MediaPlaybackState {
  // Subscribe to player store for loaded state
  const loadedPlaythrough = usePlayerUIState(
    (state) => state.loadedPlaythrough,
  );

  // Subscribe to data version to refresh when playthroughs change
  const playthroughVersion = useDataVersion(
    (state) => state.playthroughDataVersion,
  );

  // Get current play state (used when this media is loaded)
  const { playing } = useIsPlaying();

  // Check if this specific media is currently loaded
  const isCurrentlyLoaded = loadedPlaythrough?.mediaId === mediaId;

  // State for database query results
  const [dbState, setDbState] = useState<MediaPlaybackState>({
    type: "loading",
  });

  useEffect(() => {
    // If loaded in player, we don't need to query DB
    if (isCurrentlyLoaded) {
      // Reset to loading so we don't show stale data if media gets unloaded
      setDbState({ type: "loading" });
      return;
    }

    // Start loading
    setDbState({ type: "loading" });

    async function fetchPlaythroughState() {
      // Check for in-progress playthrough first
      const inProgress = await getInProgressPlaythrough(session, mediaId);
      if (inProgress) {
        setDbState({ type: "in_progress", playthrough: inProgress });
        return;
      }

      // Check for finished or abandoned playthrough
      const finishedOrAbandoned = await getFinishedOrAbandonedPlaythrough(
        session,
        mediaId,
      );
      if (finishedOrAbandoned) {
        setDbState({
          type: finishedOrAbandoned.status as "finished" | "abandoned",
          playthrough: finishedOrAbandoned,
        });
        return;
      }

      // No playthrough exists
      setDbState({ type: "none" });
    }

    fetchPlaythroughState();
  }, [session, mediaId, playthroughVersion, isCurrentlyLoaded]);

  // If this media is currently loaded in the player, return loaded state
  if (isCurrentlyLoaded && loadedPlaythrough) {
    return {
      type: "loaded",
      isPlaying: playing ?? false,
      playthrough: { id: loadedPlaythrough.playthroughId },
    };
  }

  // Otherwise return the database-queried state
  return dbState;
}

/**
 * Hook to get a playthrough by ID for prompts/dialogs.
 * Uses the library data fetching pattern for automatic refresh.
 */
export function usePlaythroughForPrompt(playthroughId: string) {
  const session = useSession((state) => state.session);
  const playthrough = useLibraryData(async () => {
    if (!session) return;
    return getPlaythroughById(session, playthroughId);
  }, [playthroughId]);
  return { playthrough, session };
}

type ShouldPromptForFinishResult =
  | { shouldPrompt: true; playthroughId: string }
  | { shouldPrompt: false };

/**
 * Determines if the user should be prompted to finish the active playthrough.
 * This is based on whether the playback progress has crossed the defined
 * threshold and if the playthrough is not already marked as finished.
 */
export async function shouldPromptForFinish(
  session: Session,
): Promise<ShouldPromptForFinishResult> {
  const { position, duration, loadedPlaythrough } = usePlayerUIState.getState();

  if (!loadedPlaythrough) return { shouldPrompt: false };

  const playthrough = await getPlaythroughById(
    session,
    loadedPlaythrough.playthroughId,
  );

  if (!playthrough) return { shouldPrompt: false };

  const progress = duration === 0 ? 0 : position / duration;

  if (
    progress >= FINISH_PROMPT_THRESHOLD &&
    playthrough.status !== "finished"
  ) {
    return { shouldPrompt: true, playthroughId: playthrough.id };
  } else {
    return { shouldPrompt: false };
  }
}
