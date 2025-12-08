/**
 * Jest setup file - runs before each test file.
 */
import type { TestDatabase } from "./db-test-utils";

// =============================================================================
// Crypto Mock - use Node's crypto.randomUUID() instead of expo-crypto
// =============================================================================

jest.mock("@/utils/crypto", () => ({
  // Use global crypto object (Node's built-in, available in Jest's allowed list)
  randomUUID: () => crypto.randomUUID(),
}));

// =============================================================================
// GraphQL API Mock
// =============================================================================

// Mock functions exposed for test control
export const mockGetLibraryChangesSince = jest.fn();
export const mockGetUserChangesSince = jest.fn();
export const mockUpdatePlayerState = jest.fn();
export const mockSyncProgress = jest.fn();
export const mockCreateSession = jest.fn();
export const mockDeleteSession = jest.fn();

jest.mock("@/graphql/api", () => ({
  getLibraryChangesSince: (...args: unknown[]) =>
    mockGetLibraryChangesSince(...args),
  getUserChangesSince: (...args: unknown[]) => mockGetUserChangesSince(...args),
  updatePlayerState: (...args: unknown[]) => mockUpdatePlayerState(...args),
  syncProgress: (...args: unknown[]) => mockSyncProgress(...args),
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  deleteSession: (...args: unknown[]) => mockDeleteSession(...args),
  // Re-export enums that are imported from api.ts
  CreateSessionErrorCode: {
    INVALID_CREDENTIALS: "CreateSessionErrorCodeInvalidCredentials",
  },
  DeviceType: {
    Android: "ANDROID",
    Ios: "IOS",
    Web: "WEB",
  },
  PlaybackEventType: {
    Abandon: "ABANDON",
    Finish: "FINISH",
    Pause: "PAUSE",
    Play: "PLAY",
    RateChange: "RATE_CHANGE",
    Seek: "SEEK",
    Start: "START",
  },
  PlaythroughStatus: {
    Abandoned: "ABANDONED",
    Finished: "FINISHED",
    InProgress: "IN_PROGRESS",
  },
}));

// =============================================================================
// React Native Track Player Mock
// =============================================================================

export const mockTrackPlayerGetProgress = jest.fn();
export const mockTrackPlayerGetRate = jest.fn();
export const mockTrackPlayerSeekTo = jest.fn();

jest.mock("react-native-track-player", () => ({
  __esModule: true,
  default: {
    getProgress: () => mockTrackPlayerGetProgress(),
    getRate: () => mockTrackPlayerGetRate(),
    seekTo: (pos: number) => mockTrackPlayerSeekTo(pos),
  },
}));

// =============================================================================
// Expo FileSystem Mock
// =============================================================================

const mockDownloadResumable = {
  downloadAsync: jest.fn(),
  cancelAsync: jest.fn(),
};

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///test-document-directory/",
  downloadAsync: jest.fn(),
  deleteAsync: jest.fn(),
  createDownloadResumable: jest.fn(() => mockDownloadResumable),
}));

// Export for test access
export { mockDownloadResumable };

// =============================================================================
// Expo SecureStore Mock
// =============================================================================

// In-memory storage for SecureStore
const mockSecureStoreData: Record<string, string> = {};

jest.mock("expo-secure-store", () => ({
  // Sync versions (used by zustand persist)
  getItem: jest.fn((key: string) => mockSecureStoreData[key] ?? null),
  setItem: jest.fn((key: string, value: string) => {
    mockSecureStoreData[key] = value;
  }),
  // Async versions
  getItemAsync: jest.fn((key: string) =>
    Promise.resolve(mockSecureStoreData[key] ?? null),
  ),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStoreData[key] = value;
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    delete mockSecureStoreData[key];
    return Promise.resolve();
  }),
}));

/**
 * Clear all SecureStore data. Call this in beforeEach to reset state.
 */
export function clearSecureStore(): void {
  for (const key of Object.keys(mockSecureStoreData)) {
    delete mockSecureStoreData[key];
  }
}

/**
 * Set a value in the mock SecureStore. Useful for test setup.
 */
export function setSecureStoreItem(key: string, value: string): void {
  mockSecureStoreData[key] = value;
}

// =============================================================================
// Expo Device Mock
// =============================================================================

jest.mock("expo-device", () => ({
  brand: "TestBrand",
  modelName: "TestModel",
  osName: "TestOS",
  osVersion: "1.0.0",
}));

// =============================================================================
// Database Mock
// =============================================================================

// Store for the test database instance
// Must be prefixed with "mock" to be accessible inside jest.mock() factory
let mockTestDb: TestDatabase | null = null;

/**
 * Set the test database instance. Call this in beforeEach after creating
 * a test database with createTestDatabase().
 */
export function setTestDb(db: TestDatabase): void {
  mockTestDb = db;
}

/**
 * Clear the test database instance. Call this in afterEach.
 */
export function clearTestDb(): void {
  mockTestDb = null;
}

// Mock the db module to use our test database
jest.mock("@/db/db", () => ({
  getDb: () => {
    if (!mockTestDb) {
      throw new Error(
        "Test database not initialized. Call setTestDb() in beforeEach.",
      );
    }
    return mockTestDb;
  },
  Database: {},
}));

// =============================================================================
// Console Suppression
// =============================================================================

// Suppress console output during tests to keep output clean
beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "debug").mockImplementation(() => {});
  jest.spyOn(console, "info").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});
