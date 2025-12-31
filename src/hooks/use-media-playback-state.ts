import { useEffect, useState } from "react";

import {
  ActivePlaythrough,
  getFinishedOrAbandonedPlaythrough,
  getInProgressPlaythrough,
} from "@/db/playthroughs";
import { useIsPlaying } from "@/services/trackplayer-wrapper";
import { useDataVersion } from "@/stores/data-version";
import { usePlayer } from "@/stores/player";
import { Session } from "@/stores/session";

// Re-export the playthrough type for convenience
export type { ActivePlaythrough };

/**
 * Type for finished or abandoned playthroughs.
 * Includes stateCache for position info and media for duration.
 */
export type FinishedOrAbandonedPlaythrough = NonNullable<
  Awaited<ReturnType<typeof getFinishedOrAbandonedPlaythrough>>
>;

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
  const loadedPlaythrough = usePlayer((state) => state.loadedPlaythrough);

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
