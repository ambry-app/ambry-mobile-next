import { NativeModule, requireNativeModule } from "expo-modules-core";

import {
  MotionDetectedEvent,
  ShakeDetectorEvents,
} from "./ShakeDetector.types";

declare class ShakeDetectorModuleType extends NativeModule<ShakeDetectorEvents> {
  start(sampleWindow: number, threshold: number, debugMode: boolean): void;
  stop(): void;
  isRunning(): boolean;
}

const ShakeDetectorModule =
  requireNativeModule<ShakeDetectorModuleType>("ShakeDetector");

export function start(
  sampleWindow: number,
  threshold: number,
  debugMode: boolean,
): void {
  ShakeDetectorModule.start(sampleWindow, threshold, debugMode);
}

export function stop(): void {
  ShakeDetectorModule.stop();
}

export function isRunning(): boolean {
  return ShakeDetectorModule.isRunning();
}

export function addMotionListener(
  listener: (event: MotionDetectedEvent) => void,
): { remove: () => void } {
  const subscription = ShakeDetectorModule.addListener(
    "onMotionDetected",
    listener,
  );
  return subscription;
}

export { MotionDetectedEvent, ShakeDetectorEvents };
