/**
 * Zustand store for Seek UI state.
 *
 * This store holds UI state related to seeking. It is owned by the seek-service,
 * which is the only code allowed to call setState on this store.
 */

import { create } from "zustand";

// ============================================================================
// Types
// ============================================================================

export interface SeekUIState {
  userIsSeeking: boolean;
  seekIsApplying: boolean;
  seekEffectiveDiff: number | null;
  seekLastDirection: "left" | "right" | null;
  seekPosition: number | null;
}

// ============================================================================
// Store
// ============================================================================

const initialState: SeekUIState = {
  userIsSeeking: false,
  seekIsApplying: false,
  seekEffectiveDiff: null,
  seekLastDirection: null,
  seekPosition: null,
};

export const useSeekUIState = create<SeekUIState>()(() => initialState);

// ============================================================================
// Actions (only seek-service should call these)
// ============================================================================

export function setSeekingState(state: Partial<SeekUIState>) {
  useSeekUIState.setState(state);
}

export function clearSeekingState() {
  useSeekUIState.setState(initialState);
}
