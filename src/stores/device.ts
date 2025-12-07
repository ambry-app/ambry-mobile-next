import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

import { randomUUID } from "@/src/utils/crypto";

const DEVICE_ID_KEY = "Ambry_deviceId";

export type DeviceType = "ios" | "android" | "web";

export interface DeviceInfo {
  id: string;
  type: DeviceType;
  brand: string | null;
  modelName: string | null;
  osName: string | null;
  osVersion: string | null;
}

interface DeviceState {
  initialized: boolean;
  deviceInfo: DeviceInfo | null;
}

export const useDevice = create<DeviceState>(() => ({
  initialized: false,
  deviceInfo: null,
}));

/**
 * Initialize the device store.
 * Loads or creates device ID from SecureStore and gathers device info.
 */
export async function initializeDevice() {
  if (useDevice.getState().initialized) {
    console.debug("[Device] Already initialized, skipping");
    return;
  }

  console.debug("[Device] Initializing");

  // Get or create device ID
  let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);

  if (!deviceId) {
    deviceId = randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    console.debug("[Device] Generated new device ID:", deviceId);
  } else {
    console.debug("[Device] Retrieved existing device ID:", deviceId);
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
