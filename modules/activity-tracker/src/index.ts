import { NativeModule, requireNativeModule } from "expo-modules-core";

import {
  ActivityChangePayload,
  ActivityTrackerEvents,
  PermissionStatus,
  TrackingStatus,
} from "./ActivityTracker.types";

declare class ActivityTrackerModuleType extends NativeModule<ActivityTrackerEvents> {
  getPermissionStatus(): Promise<PermissionStatus>;
  requestPermission(): Promise<PermissionStatus>;
  startTracking(): Promise<TrackingStatus>;
  stopTracking(): Promise<TrackingStatus>;
  isGooglePlayServicesAvailable?: boolean;
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

export function addActivityChangeListener(
  listener: (payload: ActivityChangePayload) => void,
): { remove: () => void } {
  const subscription = ActivityTrackerModule.addListener(
    "onActivityChange",
    listener,
  );
  return subscription;
}

export const isGooglePlayServicesAvailable =
  ActivityTrackerModule.isGooglePlayServicesAvailable ?? false;

export * from "./ActivityTracker.types";
