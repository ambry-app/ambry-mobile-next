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

import { FINISH_PROMPT_THRESHOLD_PERCENT } from "@/constants";
import {
  FinishedOrAbandonedPlaythrough,
  getFinishedOrAbandonedPlaythrough,
  getInProgressPlaythroughWithMedia,
  getPlaythroughWithMedia,
  type PlaythroughWithMedia,
} from "@/db/playthroughs";
import { useDataVersion } from "@/stores/data-version";
import { useSession } from "@/stores/session";
import { useTrackPlayer } from "@/stores/track-player";
import { Session } from "@/types/session";

import { useLibraryData } from "./library-service";
import * as Player from "./track-player-service";

// Re-export types and functions for UI consumers
export {
  getAllPlaythroughsForMedia,
  type PlaythroughForMedia,
} from "@/db/playthroughs";

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
  | { type: "in_progress"; playthrough: PlaythroughWithMedia }
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
  const playthrough = useTrackPlayer((state) => state.playthrough);
  // Subscribe to data version to refresh when playthroughs change
  const playthroughVersion = useDataVersion(
    (state) => state.playthroughDataVersion,
  );

  // Get current play state (used when this media is loaded)
  const { playing } = useTrackPlayer((state) => state.isPlaying);

  // Check if this specific media is currently loaded
  const isCurrentlyLoaded = playthrough?.mediaId === mediaId;

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
      const inProgress = await getInProgressPlaythroughWithMedia(
        session,
        mediaId,
      );
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
  if (isCurrentlyLoaded && playthrough) {
    return {
      type: "loaded",
      isPlaying: playing ?? false,
      playthrough: { id: playthrough.id },
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
    return getPlaythroughWithMedia(session, playthroughId);
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
export async function shouldPromptForFinish(): Promise<ShouldPromptForFinishResult> {
  const playthrough = Player.getLoadedPlaythrough();
  const progress = Player.getProgress();

  if (!playthrough) return { shouldPrompt: false };

  if (
    progress.percent >= FINISH_PROMPT_THRESHOLD_PERCENT &&
    playthrough.status !== "finished"
  ) {
    return { shouldPrompt: true, playthroughId: playthrough.id };
  } else {
    return { shouldPrompt: false };
  }
}
