/**
 * Simplified activity state - just stationary vs not stationary.
 */
export enum ActivityState {
  STATIONARY = "STATIONARY",
  NOT_STATIONARY = "NOT_STATIONARY",
}

/**
 * Permission status for activity tracking.
 */
export enum PermissionStatus {
  AUTHORIZED = "AUTHORIZED",
  DENIED = "DENIED",
  RESTRICTED = "RESTRICTED",
  NOT_DETERMINED = "NOT_DETERMINED",
  UNAVAILABLE = "UNAVAILABLE",
}

/**
 * Tracking status returned from startTracking.
 */
export enum TrackingStatus {
  STARTED = "STARTED",
  STOPPED = "STOPPED",
  UNAUTHORIZED = "UNAUTHORIZED",
  FAILED = "FAILED",
}

/**
 * Confidence level for the activity classification.
 */
export enum Confidence {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

/**
 * Event payload sent from native module.
 */
export type ActivityStatePayload = {
  state: ActivityState;
  confidence: Confidence;
  timestamp: number;
};

/**
 * Events emitted by the ActivityTracker module.
 */
export type ActivityTrackerEvents = {
  onActivityStateChange: (payload: ActivityStatePayload) => void;
};
