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
export const mockSyncProgress = jest.fn();
export const mockCreateSession = jest.fn();
export const mockDeleteSession = jest.fn();

jest.mock("@/graphql/api", () => ({
  getLibraryChangesSince: (...args: unknown[]) =>
    mockGetLibraryChangesSince(...args),
  syncProgress: (...args: unknown[]) => mockSyncProgress(...args),
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  deleteSession: (...args: unknown[]) => mockDeleteSession(...args),
  // Re-export enums that are imported from api.ts
  CreateSessionErrorCode: {
    INVALID_CREDENTIALS: "CreateSessionErrorCodeInvalidCredentials",
  },
  DeviceTypeInput: {
    Android: "ANDROID",
    Ios: "IOS",
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

// Mock functions for methods that need test control
export const mockTrackPlayerGetProgress = jest.fn();
export const mockTrackPlayerGetRate = jest.fn();
export const mockTrackPlayerSeekTo = jest.fn();
export const mockTrackPlayerPlay = jest.fn();
export const mockTrackPlayerPause = jest.fn();
export const mockTrackPlayerSetRate = jest.fn();
export const mockTrackPlayerSetVolume = jest.fn();
export const mockTrackPlayerReset = jest.fn();
export const mockTrackPlayerAdd = jest.fn();
export const mockTrackPlayerGetTrack = jest.fn();
export const mockTrackPlayerSetupPlayer = jest.fn();
export const mockTrackPlayerUpdateOptions = jest.fn();
export const mockTrackPlayerAddEventListener = jest.fn();
export const mockIsPlaying = jest.fn().mockResolvedValue({ playing: false });

// =============================================================================
// TrackPlayer Wrapper Mock
// =============================================================================
// Mock the wrapper module to use the same mock functions as the native module.
// This is needed because most code now imports from the wrapper instead of
// react-native-track-player directly.

jest.mock("@/services/trackplayer-wrapper", () => ({
  // Playback Control
  play: () => mockTrackPlayerPlay(),
  pause: () => mockTrackPlayerPause(),
  seekTo: (pos: number) => mockTrackPlayerSeekTo(pos),
  setRate: (rate: number) => mockTrackPlayerSetRate(rate),
  setVolume: (volume: number) => mockTrackPlayerSetVolume(volume),
  // Queue Management
  reset: () => mockTrackPlayerReset(),
  add: (track: unknown) => mockTrackPlayerAdd(track),
  getTrack: (index: number) => mockTrackPlayerGetTrack(index),
  // State Queries
  getProgress: () => mockTrackPlayerGetProgress(),
  getRate: () => mockTrackPlayerGetRate(),
  isPlaying: () => mockIsPlaying(),
  // Event Listeners
  addEventListener: (event: string, handler: unknown) =>
    mockTrackPlayerAddEventListener(event, handler),
  // Setup
  setupPlayer: (options: unknown) => mockTrackPlayerSetupPlayer(options),
  updateOptions: (options: unknown) => mockTrackPlayerUpdateOptions(options),
  registerPlaybackService: jest.fn(),
  // Re-exported enums
  Event: {
    PlaybackProgressUpdated: "playback-progress-updated",
    PlaybackQueueEnded: "playback-queue-ended",
    RemoteDuck: "remote-duck",
    RemoteJumpBackward: "remote-jump-backward",
    RemoteJumpForward: "remote-jump-forward",
    RemotePause: "remote-pause",
    RemotePlay: "remote-play",
  },
  State: {
    None: "none",
    Ready: "ready",
    Playing: "playing",
    Paused: "paused",
    Stopped: "stopped",
    Buffering: "buffering",
    Loading: "loading",
  },
  Capability: {
    Play: "play",
    Pause: "pause",
    JumpForward: "jump-forward",
    JumpBackward: "jump-backward",
  },
  AndroidAudioContentType: {
    Speech: "speech",
    Music: "music",
  },
  IOSCategory: {
    Playback: "playback",
  },
  IOSCategoryMode: {
    SpokenAudio: "spokenAudio",
    Default: "default",
  },
  PitchAlgorithm: {
    Voice: "voice",
    Music: "music",
  },
  TrackType: {
    Dash: "dash",
    HLS: "hls",
    Default: "default",
  },
  // React hooks
  useIsPlaying: jest.fn(() => ({ playing: false, bufferingDuringPlay: false })),
  usePlaybackState: jest.fn(() => ({ state: "none" })),
}));

// =============================================================================
// Expo FileSystem Mock
// =============================================================================

const mockDownloadResumable = {
  downloadAsync: jest.fn(),
  cancelAsync: jest.fn(),
};

// Modern API - only Paths is used from here
jest.mock("expo-file-system", () => ({
  Paths: {
    document: {
      uri: "file:///test-document-directory/",
    },
  },
}));

// Legacy API - download functions with progress tracking
jest.mock("expo-file-system/legacy", () => ({
  downloadAsync: jest.fn(),
  deleteAsync: jest.fn(),
  createDownloadResumable: jest.fn(() => mockDownloadResumable),
}));

// Export for test access
export { mockDownloadResumable };

// =============================================================================
// Expo Background Task / Task Manager Mocks
// =============================================================================

// Store the defined task callback so tests can invoke it
let definedTaskCallback: (() => Promise<unknown>) | null = null;

export const mockIsTaskRegisteredAsync = jest.fn();
export const mockRegisterTaskAsync = jest.fn();
export const mockUnregisterTaskAsync = jest.fn();

jest.mock("expo-task-manager", () => ({
  defineTask: (_name: string, callback: () => Promise<unknown>) => {
    definedTaskCallback = callback;
  },
  isTaskRegisteredAsync: (name: string) => mockIsTaskRegisteredAsync(name),
}));

jest.mock("expo-background-task", () => ({
  registerTaskAsync: (name: string, options: unknown) =>
    mockRegisterTaskAsync(name, options),
  unregisterTaskAsync: (name: string) => mockUnregisterTaskAsync(name),
  BackgroundTaskResult: {
    Success: "success",
    Failed: "failed",
  },
}));

/**
 * Get the task callback defined via TaskManager.defineTask.
 * Use this to manually invoke the background task in tests.
 */
export function getDefinedTaskCallback() {
  return definedTaskCallback;
}

/**
 * Reset the defined task callback. Call in afterEach.
 */
export function clearDefinedTaskCallback() {
  definedTaskCallback = null;
}

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

// Mock for getExpoDb().execSync() used in background sync
export const mockExpoDbExecSync = jest.fn();

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
  getExpoDb: () => ({
    execSync: mockExpoDbExecSync,
  }),
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
