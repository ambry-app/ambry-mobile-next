import { NativeModule, requireNativeModule } from "expo-modules-core";

import {
  ActivityStatePayload,
  ActivityTrackerEvents,
  PermissionStatus,
  TrackingStatus,
} from "./ActivityTracker.types";

declare class ActivityTrackerModuleType extends NativeModule<ActivityTrackerEvents> {
  getPermissionStatus(): Promise<PermissionStatus>;
  requestPermission(): Promise<PermissionStatus>;
  startTracking(): Promise<TrackingStatus>;
  stopTracking(): Promise<TrackingStatus>;
}

const ActivityTrackerModule =
  requireNativeModule<ActivityTrackerModuleType>("ActivityTracker");

export async function getPermissionStatus(): Promise<PermissionStatus> {
  return ActivityTrackerModule.getPermissionStatus();
}

export async function requestPermission(): Promise<PermissionStatus> {
  return ActivityTrackerModule.requestPermission();
}

export async function startTracking(): Promise<TrackingStatus> {
  return ActivityTrackerModule.startTracking();
}

export async function stopTracking(): Promise<TrackingStatus> {
  return ActivityTrackerModule.stopTracking();
}

export function addActivityStateListener(
  listener: (payload: ActivityStatePayload) => void,
): { remove: () => void } {
  const subscription = ActivityTrackerModule.addListener(
    "onActivityStateChange",
    listener,
  );
  return subscription;
}

export * from "./ActivityTracker.types";
