export type MotionDetectedEvent = {
  variance: number;
  timestamp: number;
};

export type ShakeDetectorEvents = {
  onMotionDetected: (event: MotionDetectedEvent) => void;
};
