import type { SeekSourceType } from "@/stores/player";

// Callback types for UI components
export type ExpandPlayerCallback = () => void;
export type ScrubberSeekCallback = (payload: SeekAppliedPayload) => void;

// Event payloads
export interface SeekAppliedPayload {
  position: number;
  duration: number;
  userInitiated: boolean;
  source: SeekSourceType;
}

export interface SeekCompletedPayload {
  fromPosition: number;
  toPosition: number;
  timestamp: Date;
}

export interface RateChangedPayload {
  previousRate: number;
  newRate: number;
  position: number;
}
