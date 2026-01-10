import { Platform } from "react-native";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import { DeviceInfo } from "@/types/device-info";
import { randomUUID } from "@/utils/crypto";
import { logBase } from "@/utils/logger";

const log = logBase.extend("device");

const DEVICE_ID_KEY = "Ambry_deviceId";

interface DeviceState {
  initialized: boolean;
  deviceInfo: DeviceInfo | null;
}

export const initialDeviceState: DeviceState = {
  initialized: false,
  deviceInfo: null,
};

export const useDevice = create<DeviceState>(() => initialDeviceState);

// FIXME: we can probably _not_ call this initialize in so many places
/**
 * Initialize the device store.
 * Loads or creates device ID from SecureStore and gathers device info.
 */
export async function initializeDevice() {
  if (useDevice.getState().initialized) {
    log.debug("Already initialized, skipping");
    return;
  }

  log.debug("Initializing");

  // Get or create device ID
  let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);

  if (!deviceId) {
    deviceId = randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    log.debug("Generated new device ID:", deviceId);
  } else {
    log.debug("Retrieved existing device ID:", deviceId);
  }

  const deviceInfo: DeviceInfo = {
    id: deviceId,
    type:
      Platform.OS === "ios"
        ? "ios"
        : Platform.OS === "android"
          ? "android"
          : "web",
    brand: Device.brand,
    modelName: Device.modelName,
    osName: Device.osName,
    osVersion: Device.osVersion,
  };

  useDevice.setState({
    initialized: true,
    deviceInfo,
  });
}

/**
 * Get device ID synchronously. Returns null if not initialized.
 * Prefer using useDevice() hook in components.
 */
export function getDeviceIdSync(): string | null {
  return useDevice.getState().deviceInfo?.id ?? null;
}

/**
 * Gets device info, waiting for initialization if necessary.
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  if (!useDevice.getState().initialized) {
    await initializeDevice();
  }
  return useDevice.getState().deviceInfo!;
}

/**
 * Reset store to initial state for testing.
 */
export function resetForTesting() {
  useDevice.setState(initialDeviceState, true);
}
