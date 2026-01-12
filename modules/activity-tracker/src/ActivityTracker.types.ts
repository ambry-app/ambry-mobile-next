export enum ActivityType {
  UNKNOWN = "UNKNOWN",
  WALKING = "WALKING",
  RUNNING = "RUNNING",
  AUTOMOTIVE = "AUTOMOTIVE",
  STATIONARY = "STATIONARY",
  CYCLING = "CYCLING",
}

export enum TransitionType {
  ENTER = "ENTER",
  EXIT = "EXIT",
}

export enum Confidence {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  UNKNOWN = "UNKNOWN",
}

export enum PermissionStatus {
  NOT_DETERMINED = "NOT_DETERMINED",
  RESTRICTED = "RESTRICTED",
  DENIED = "DENIED",
  AUTHORIZED = "AUTHORIZED",
  UNAVAILABLE = "UNAVAILABLE",
}

export enum TrackingStatus {
  STARTED = "STARTED",
  STOPPED = "STOPPED",
  FAILED = "FAILED",
  UNAUTHORIZED = "UNAUTHORIZED",
}

export type ActivityChangeEvent = {
  activityType: ActivityType;
  transitionType: TransitionType;
  confidence: Confidence;
  timestamp: number;
};

export type ActivityChangePayload = {
  events: ActivityChangeEvent[];
};

export type ActivityTrackerEvents = {
  onActivityChange: (payload: ActivityChangePayload) => void;
};
