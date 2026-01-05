import { create } from "zustand";

import { Chapter } from "@/types/db-schema";

// ============================================================================
// Types
// ============================================================================

export const SeekSource = {
  BUTTON: "button",
  CHAPTER: "chapter",
  REMOTE: "remote",
  SCRUBBER: "scrubber",
  PAUSE: "pause",
} as const;

export type SeekSourceType = (typeof SeekSource)[keyof typeof SeekSource];

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
  loadingNewMedia: boolean;

  /* playback state */

  /** Current TrackPlayer position */
  position: number;
  /** Current TrackPlayer duration */
  duration: number;
  /** Current TrackPlayer playback rate */

  /** Whether mini player content should render (true when collapsed or animating) */
  shouldRenderMini: boolean;
  /** Whether expanded player content should render (true when expanded or animating) */
  shouldRenderExpanded: boolean;

  /* chapter state */
  chapters: Chapter[];
  currentChapter: Chapter | undefined;
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
  loadingNewMedia: false,
  position: 0,
  duration: 0,
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
// Getters
// ============================================================================

export type PlaythroughProgress = {
  loadedPlaythrough: LoadedPlaythrough;
  progressPercent: number;
  position: number;
  duration: number;
};

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
  chapters: Chapter[],
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
