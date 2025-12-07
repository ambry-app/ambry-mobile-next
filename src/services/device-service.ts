import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const DEVICE_ID_KEY = "Ambry_deviceId";

let cachedDeviceId: string | null = null;

/**
 * Get or create a persistent device ID.
 * The ID is stored in SecureStore and persists across app reinstalls on iOS
 * (via Keychain) but not on Android (cleared on uninstall).
 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);

  if (!deviceId) {
    deviceId = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    console.debug("[DeviceService] Generated new device ID:", deviceId);
  } else {
    console.debug("[DeviceService] Retrieved existing device ID:", deviceId);
  }

  cachedDeviceId = deviceId;
  return deviceId;
}

/**
 * Synchronous version for cases where ID is already cached.
 * Returns null if not yet initialized - call getDeviceId() first.
 */
export function getDeviceIdSync(): string | null {
  return cachedDeviceId;
}

export type DeviceType = "ios" | "android" | "web";

export interface DeviceInfo {
  id: string;
  type: DeviceType;
  brand: string | null;
  modelName: string | null;
  osName: string | null;
  osVersion: string | null;
}

/**
 * Get complete device information for sync.
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const id = await getDeviceId();

  return {
    id,
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
}
