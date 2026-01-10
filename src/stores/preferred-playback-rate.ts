import { create } from "zustand";

import { DEFAULT_PREFERRED_PLAYBACK_RATE } from "@/constants";

export interface PreferredPlaybackRateState {
  initialized: boolean;
  preferredPlaybackRate: number;
}

export const initialState: PreferredPlaybackRateState = {
  initialized: false,
  preferredPlaybackRate: DEFAULT_PREFERRED_PLAYBACK_RATE,
};

export const usePreferredPlaybackRate = create<PreferredPlaybackRateState>()(
  () => initialState,
);

/**
 * Reset store to initial state for testing.
 */
export function resetForTesting() {
  usePreferredPlaybackRate.setState(initialState, true);
}
