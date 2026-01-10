/**
 * Zustand store for Player UI state.
 *
 * This store holds the state that only the UI needs.  If something is needed by
 * all services regardless of whether the UI is mounted, it belongs in the
 * track-player store instead.
 */

import { create } from "zustand";

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
  initialized: boolean;

  /* player UI state */
  loadingNewMedia: boolean;
  expanded: boolean;
  pendingExpandPlayer: boolean;

  /* seek UI state */
  userIsSeeking: boolean;
  seekIsApplying: boolean;
  seekEffectiveDiff: number | null;
  seekLastDirection: "left" | "right" | null;
  seekPosition: number | null;
  lastSeekTimestamp: number | null;
  lastSeekSource: SeekSourceType | null;
}

// ============================================================================
// Store
// ============================================================================

const initialState = {
  loadingNewMedia: false,
  expanded: true,
  pendingExpandPlayer: false,
  userIsSeeking: false,
  seekIsApplying: false,
  seekEffectiveDiff: null,
  seekLastDirection: null,
  seekPosition: null,
  lastSeekTimestamp: null,
  lastSeekSource: null,
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

export function setPlayerExpandedState(expanded: boolean) {
  usePlayerUIState.setState({
    expanded,
  });
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
