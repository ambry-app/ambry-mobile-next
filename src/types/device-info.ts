export type DeviceType = "ios" | "android" | "web";

export interface DeviceInfo {
  id: string;
  type: DeviceType;
  brand: string | null;
  modelName: string | null;
  osName: string | null;
  osVersion: string | null;
}
