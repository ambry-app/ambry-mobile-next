import { useEffect } from "react";
import { AppStateStatus, EmitterSubscription } from "react-native";
import { create } from "zustand";

import * as schema from "@/db/schema";
import type { SeekSourceType } from "@/services/seek-service";
import * as Player from "@/services/trackplayer-wrapper";
import { Event } from "@/services/trackplayer-wrapper";

// ============================================================================
// Types
// ============================================================================

/**
 * Represents the currently loaded playthrough in the player.
 * Both mediaId and playthroughId are always set together (or both null when unloaded).
 */
export interface LoadedPlaythrough {
  mediaId: string;
  playthroughId: string;
}

export interface PlayerUIState {
  /* initialization state */
  initialized: boolean;
  /** The currently loaded playthrough, or null if no media is loaded */
  loadedPlaythrough: LoadedPlaythrough | null;
  streaming: boolean | undefined;
  loadingNewMedia: boolean;

  /* playback state */

  /** Current TrackPlayer position */
  position: number;
  /** Current TrackPlayer duration */
  duration: number;
  /** Current TrackPlayer playback rate */
  playbackRate: number;

  /** Whether mini player content should render (true when collapsed or animating) */
  shouldRenderMini: boolean;
  /** Whether expanded player content should render (true when expanded or animating) */
  shouldRenderExpanded: boolean;

  /* chapter state */
  chapters: schema.Chapter[];
  currentChapter: schema.Chapter | undefined;
  previousChapterStartTime: number;

  /* seek state - for UI animation */
  userIsSeeking: boolean;
  seekIsApplying: boolean;
  seekEffectiveDiff: number | null;
  seekLastDirection: "left" | "right" | null;
  seekPosition: number | null;
  // When a seek is applied, this is set to Date.now()
  // The Scrubber watches for changes to know "a seek just happened"
  lastSeekTimestamp: number | null;
  lastSeekSource: SeekSourceType | null;

  /* UI state */
  pendingExpandPlayer: boolean;
}

// ============================================================================
// Store
// ============================================================================

const initialState = {
  loadedPlaythrough: null,
  streaming: undefined,
  loadingNewMedia: false,
  position: 0,
  duration: 0,
  playbackRate: 1,
  shouldRenderMini: false,
  shouldRenderExpanded: true,
  chapters: [],
  currentChapter: undefined,
  previousChapterStartTime: 0,
  userIsSeeking: false,
  seekIsApplying: false,
  seekEffectiveDiff: null,
  seekLastDirection: null,
  seekPosition: null,
  lastSeekTimestamp: null,
  lastSeekSource: null,
  pendingExpandPlayer: false,
};

export const usePlayerUIState = create<PlayerUIState>()(() => ({
  initialized: false,
  ...initialState,
}));

// ============================================================================
// Actions
// ============================================================================

/**
 * Reset the store to its initial state.
 * Used when the player is unloaded.
 */
export function resetPlayerUIState() {
  usePlayerUIState.setState(initialState);
}

export function setPlayerRenderState(
  shouldRenderMini: boolean,
  shouldRenderExpanded: boolean,
) {
  usePlayerUIState.setState({ shouldRenderMini, shouldRenderExpanded });
}

export function requestExpandPlayer() {
  usePlayerUIState.setState({ pendingExpandPlayer: true });
}

export function clearPendingExpand() {
  usePlayerUIState.setState({ pendingExpandPlayer: false });
}

export function setLastSeek(source: SeekSourceType) {
  usePlayerUIState.setState({
    lastSeekTimestamp: Date.now(),
    lastSeekSource: source,
  });
}

/**
 * Update player position and duration state.
 * This is the main driver for the UI's position display.
 */
export function setProgress(position: number, duration: number) {
  usePlayerUIState.setState({ position, duration });
  maybeUpdateChapterState();
}

/**
 * Updates the current chapter based on the playback position.
 * Called by setProgress on every position update.
 */
function maybeUpdateChapterState() {
  const { position, currentChapter } = usePlayerUIState.getState();

  if (!currentChapter) {
    return;
  }

  // Check if position has moved out of the current chapter's bounds
  if (
    position < currentChapter.startTime ||
    (currentChapter.endTime && position >= currentChapter.endTime)
  ) {
    const { duration, chapters } = usePlayerUIState.getState();
    const nextChapter = chapters.find(
      (chapter) => position < (chapter.endTime || duration),
    );

    if (nextChapter) {
      usePlayerUIState.setState({
        currentChapter: nextChapter,
        previousChapterStartTime:
          chapters[chapters.indexOf(nextChapter) - 1]?.startTime || 0,
      });
    }
  }
}

/**
 * Set the initial chapter state when a new track is loaded.
 */
export function initialChapterState(
  chapters: schema.Chapter[],
  position: number,
  duration: number,
) {
  const currentChapter = chapters.find(
    (chapter) => position < (chapter.endTime || duration),
  );

  if (!currentChapter)
    return {
      chapters,
      currentChapter,
      previousChapterStartTime: 0,
    };

  const previousChapterStartTime =
    chapters[chapters.indexOf(currentChapter) - 1]?.startTime || 0;

  return { chapters, currentChapter, previousChapterStartTime };
}

// ============================================================================
// Hooks
// ============================================================================

// FIXME: this is not pure zustand state logic and should be moved elsewhere

const POSITION_POLL_INTERVAL = 1000; // 1 second for position/duration

/**
 * Subscribes to TrackPlayer events and polls for position to keep the UI
 * state in sync with the native player.
 */
export function usePlayerSubscriptions(appState: AppStateStatus) {
  const playerLoaded = usePlayerUIState((state) => !!state.loadedPlaythrough);

  useEffect(() => {
    const subscriptions: EmitterSubscription[] = [];
    let positionIntervalId: NodeJS.Timeout | null = null;

    const pollPosition = async () => {
      try {
        const progress = await Player.getProgress();
        setProgress(progress.position, progress.duration);
      } catch (error) {
        // Can happen if player is reset while polling
        console.warn("[PlayerUI] Error polling position:", error);
      }
    };

    const onPlaybackQueueEnded = () => {
      const { duration } = usePlayerUIState.getState();
      console.debug("[PlayerUI] PlaybackQueueEnded at position", duration);
      setProgress(duration, duration);
    };

    if (appState === "active" && playerLoaded) {
      console.debug("[PlayerUI] Subscribing to player events");
      pollPosition(); // Initial poll

      // Poll position/duration every 1 second
      positionIntervalId = setInterval(pollPosition, POSITION_POLL_INTERVAL);

      subscriptions.push(
        Player.addEventListener(Event.PlaybackQueueEnded, onPlaybackQueueEnded),
      );
    }

    return () => {
      if (positionIntervalId) clearInterval(positionIntervalId);
      if (subscriptions.length !== 0) {
        console.debug("[PlayerUI] Unsubscribing from player events");
        subscriptions.forEach((sub) => sub.remove());
      }
    };
  }, [appState, playerLoaded]);
}
