/**
 * Identifies a scheduled timer. Pass it to `cancel` to stop the timer.
 */
export type BackgroundTimerHandle = number;

/**
 * Payload of the native module's fire event.
 */
export type TimerFiredPayload = {
  id: BackgroundTimerHandle;
};

/**
 * Events emitted by the BackgroundTimer module.
 */
export type BackgroundTimerEvents = {
  onTimerFired: (payload: TimerFiredPayload) => void;
};
