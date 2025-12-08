import { Platform } from "react-native";

import { getDeviceIdSync, initializeDevice, useDevice } from "@/stores/device";
import { clearSecureStore, setSecureStoreItem } from "@test/jest-setup";
import { resetStoreBeforeEach } from "@test/store-test-utils";

// Mock react-native Platform
jest.mock("react-native", () => ({
  Platform: {
    OS: "ios",
  },
}));

describe("device store", () => {
  resetStoreBeforeEach(useDevice, {
    initialized: false,
    deviceInfo: null,
  });

  beforeEach(() => {
    clearSecureStore();
    jest.clearAllMocks();
  });

  describe("initializeDevice", () => {
    it("generates new device ID when none exists", async () => {
      await initializeDevice();

      const state = useDevice.getState();
      expect(state.initialized).toBe(true);
      expect(state.deviceInfo).not.toBeNull();
      expect(state.deviceInfo!.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("loads existing device ID from SecureStore", async () => {
      const existingId = "existing-device-id-123";
      setSecureStoreItem("Ambry_deviceId", existingId);

      await initializeDevice();

      const state = useDevice.getState();
      expect(state.initialized).toBe(true);
      expect(state.deviceInfo!.id).toBe(existingId);
    });

    it("skips initialization if already initialized", async () => {
      // First initialization
      await initializeDevice();
      const firstId = useDevice.getState().deviceInfo!.id;

      // Clear SecureStore to simulate change
      clearSecureStore();
      setSecureStoreItem("Ambry_deviceId", "different-id");

      // Second initialization should skip
      await initializeDevice();

      // Should still have the original ID
      expect(useDevice.getState().deviceInfo!.id).toBe(firstId);
    });

    it("populates device info from expo-device", async () => {
      await initializeDevice();

      const state = useDevice.getState();
      expect(state.deviceInfo).toMatchObject({
        brand: "TestBrand",
        modelName: "TestModel",
        osName: "TestOS",
        osVersion: "1.0.0",
      });
    });

    it("sets device type to ios when Platform.OS is ios", async () => {
      (Platform as { OS: string }).OS = "ios";

      await initializeDevice();

      expect(useDevice.getState().deviceInfo!.type).toBe("ios");
    });

    it("sets device type to android when Platform.OS is android", async () => {
      (Platform as { OS: string }).OS = "android";

      await initializeDevice();

      expect(useDevice.getState().deviceInfo!.type).toBe("android");
    });

    it("sets device type to web for other platforms", async () => {
      (Platform as { OS: string }).OS = "web";

      await initializeDevice();

      expect(useDevice.getState().deviceInfo!.type).toBe("web");
    });
  });

  describe("getDeviceIdSync", () => {
    it("returns null when not initialized", () => {
      expect(getDeviceIdSync()).toBeNull();
    });

    it("returns device ID when initialized", async () => {
      setSecureStoreItem("Ambry_deviceId", "test-device-id");
      await initializeDevice();

      expect(getDeviceIdSync()).toBe("test-device-id");
    });
  });
});
