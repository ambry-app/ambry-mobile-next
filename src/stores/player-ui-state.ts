/**
 * Zustand store for Player UI state.
 *
 * This store holds the state that only the UI needs. If something is needed by
 * all services regardless of whether the UI is mounted, it belongs in the
 * track-player store instead.
 *
 * This store is owned by the playback-controls service.
 */

import { create } from "zustand";

// ============================================================================
// Types
// ============================================================================

export interface PlayerUIState {
  initialized: boolean;
  loadingNewMedia: boolean;
  expanded: boolean;
  pendingExpandPlayer: boolean;
}

// ============================================================================
// Store
// ============================================================================

const initialState = {
  loadingNewMedia: false,
  expanded: true,
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

export function setLoadingNewMedia(loading: boolean) {
  usePlayerUIState.setState({
    loadingNewMedia: loading,
  });
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
