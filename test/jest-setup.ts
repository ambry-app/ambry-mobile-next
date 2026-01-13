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
// GraphQL API - NO MOCK
// =============================================================================
// We do NOT mock @/graphql/api - it's our own code and should run for real.
// Instead, mock `fetch` at the network boundary using test/fetch-mock.ts.
//
// Tests that need to control API responses should:
//   import { installFetchMock, mockGraphQL, graphqlSuccess } from "@test/fetch-mock";
//   const mockFetch = installFetchMock();
//   mockGraphQL(mockFetch, graphqlSuccess({ ... }));

// =============================================================================
// React Native Track Player Fake (Native Module)
// =============================================================================
// We use a "fake" instead of mocks - a working implementation that maintains
// internal state. This is more robust than mocks because:
// - No need to manually choreograph mock return values
// - State stays consistent automatically (seekTo updates position, etc.)
// - Tests focus on behavior, not mock orchestration
//
// The wrapper (@/services/track-player-wrapper) is our own code and runs for
// real against this fake.

// Internal fake state
interface TrackPlayerFakeState {
  position: number;
  duration: number;
  buffered: number;
  rate: number;
  volume: number;
  playWhenReady: boolean;
  playbackState: string;
  currentTrack: unknown | null;
  eventListeners: Map<string, ((event: unknown) => void)[]>;
}

const createInitialState = (): TrackPlayerFakeState => ({
  position: 0,
  duration: 0,
  buffered: 0,
  rate: 1.0,
  volume: 1.0,
  playWhenReady: false,
  playbackState: "none",
  currentTrack: null,
  eventListeners: new Map(),
});

let trackPlayerState = createInitialState();

// Track pending async event emissions so we can cancel them on reset
let pendingEventEmissions: NodeJS.Immediate[] = [];

// Helper to emit events to listeners
function emitTrackPlayerEvent(event: string, data: unknown) {
  const listeners = trackPlayerState.eventListeners.get(event) || [];
  listeners.forEach((handler) => handler(data));
}

// Helper to schedule async event emission (like real native module)
function scheduleEventEmission(emit: () => void) {
  const handle = setImmediate(emit);
  pendingEventEmissions.push(handle);
}

/**
 * Reset the TrackPlayer fake to initial state. Call in beforeEach().
 */
export function resetTrackPlayerFake() {
  // Cancel any pending async event emissions
  pendingEventEmissions.forEach((handle) => clearImmediate(handle));
  pendingEventEmissions = [];
  trackPlayerState = createInitialState();
}

/**
 * Control the TrackPlayer fake state for test setup.
 *
 * Usage:
 *   trackPlayerFake.setState({ duration: 300, position: 50 });
 */
export const trackPlayerFake = {
  setState(partial: Partial<Omit<TrackPlayerFakeState, "eventListeners">>) {
    Object.assign(trackPlayerState, partial);
  },

  getState() {
    return { ...trackPlayerState };
  },

  // Simulate external events (e.g., system interruption)
  emitPlaybackStateChange(state: string) {
    trackPlayerState.playbackState = state;
    emitTrackPlayerEvent("playback-state", { state });
  },

  emitPlayWhenReadyChange(playWhenReady: boolean) {
    trackPlayerState.playWhenReady = playWhenReady;
    emitTrackPlayerEvent("playback-play-when-ready-changed", { playWhenReady });
  },
};

// Legacy mock exports for backward compatibility with existing tests
// These delegate to the fake but allow tests to override with mockImplementation
export const mockTrackPlayerGetProgress = jest.fn(async () => ({
  position: trackPlayerState.position,
  duration: trackPlayerState.duration,
  buffered: trackPlayerState.buffered,
}));
export const mockTrackPlayerGetPlaybackState = jest.fn(async () => ({
  state: trackPlayerState.playbackState,
}));
export const mockTrackPlayerGetPlayWhenReady = jest.fn(
  async () => trackPlayerState.playWhenReady,
);
export const mockTrackPlayerGetRate = jest.fn(
  async () => trackPlayerState.rate,
);
export const mockTrackPlayerSeekTo = jest.fn(async (pos: number) => {
  trackPlayerState.position = Math.max(
    0,
    Math.min(pos, trackPlayerState.duration || pos),
  );
});
export const mockTrackPlayerPlay = jest.fn(async () => {
  trackPlayerState.playWhenReady = true;
  trackPlayerState.playbackState = "playing";
  // Emit events asynchronously like the real native module does.
  // Native events fire AFTER the JS call returns, not synchronously within it.
  // This is important for testing race conditions between event handlers.
  scheduleEventEmission(() => {
    emitTrackPlayerEvent("playback-play-when-ready-changed", {
      playWhenReady: true,
    });
    emitTrackPlayerEvent("playback-state", { state: "playing" });
  });
});
export const mockTrackPlayerPause = jest.fn(async () => {
  trackPlayerState.playWhenReady = false;
  trackPlayerState.playbackState = "paused";
  // Emit events asynchronously like the real native module does.
  scheduleEventEmission(() => {
    emitTrackPlayerEvent("playback-play-when-ready-changed", {
      playWhenReady: false,
    });
    emitTrackPlayerEvent("playback-state", { state: "paused" });
  });
});
export const mockTrackPlayerSetRate = jest.fn(async (rate: number) => {
  trackPlayerState.rate = rate;
});
export const mockTrackPlayerSetVolume = jest.fn(async (volume: number) => {
  trackPlayerState.volume = volume;
});
export const mockTrackPlayerReset = jest.fn(async () => {
  trackPlayerState.position = 0;
  trackPlayerState.currentTrack = null;
  trackPlayerState.playWhenReady = false;
  trackPlayerState.playbackState = "none";
});
export const mockTrackPlayerAdd = jest.fn(async (track: unknown) => {
  trackPlayerState.currentTrack = track;
  // If track has duration, use it
  if (track && typeof track === "object" && "duration" in track) {
    trackPlayerState.duration = (track as { duration: number }).duration;
  }
});
export const mockTrackPlayerSetupPlayer = jest.fn();
export const mockTrackPlayerUpdateOptions = jest.fn();
export const mockTrackPlayerAddEventListener = jest.fn(
  (event: string, handler: (event: unknown) => void) => {
    const listeners = trackPlayerState.eventListeners.get(event) || [];
    listeners.push(handler);
    trackPlayerState.eventListeners.set(event, listeners);
    return { remove: () => {} };
  },
);
export const mockTrackPlayerRegisterPlaybackService = jest.fn();

// Mock the native module using the fake
//
// NOTE: We duplicate enum values here because jest.requireActual() doesn't work -
// react-native-track-player requires native TurboModule which isn't available in Jest.
// These values are stable (changing them would break all library users), and if new
// values are added, tests will fail when we try to use them - alerting us to update.
jest.mock("react-native-track-player", () => {
  const Event = {
    PlaybackProgressUpdated: "playback-progress-updated",
    PlaybackQueueEnded: "playback-queue-ended",
    PlaybackState: "playback-state",
    PlaybackPlayWhenReadyChanged: "playback-play-when-ready-changed",
    PlaybackActiveTrackChanged: "playback-active-track-changed",
    RemoteDuck: "remote-duck",
    RemoteJumpBackward: "remote-jump-backward",
    RemoteJumpForward: "remote-jump-forward",
    RemotePause: "remote-pause",
    RemotePlay: "remote-play",
    RemoteStop: "remote-stop",
    RemoteSeek: "remote-seek",
  };

  const State = {
    None: "none",
    Ready: "ready",
    Playing: "playing",
    Paused: "paused",
    Stopped: "stopped",
    Buffering: "buffering",
    Loading: "loading",
    Error: "error",
    Ended: "ended",
  };

  const Capability = {
    Play: "play",
    Pause: "pause",
    Stop: "stop",
    SeekTo: "seek-to",
    Skip: "skip",
    SkipToNext: "skip-to-next",
    SkipToPrevious: "skip-to-previous",
    JumpForward: "jump-forward",
    JumpBackward: "jump-backward",
    SetRating: "set-rating",
    Like: "like",
    Dislike: "dislike",
    Bookmark: "bookmark",
  };

  const AndroidAudioContentType = { Speech: 1, Music: 2 };
  const IOSCategory = { Playback: "playback" };
  const IOSCategoryMode = { SpokenAudio: "spokenAudio", Default: "default" };
  const PitchAlgorithm = { Voice: 1, Music: 2 };
  const TrackType = { Dash: "dash", HLS: "hls", Default: "default" };

  return {
    __esModule: true,
    default: {
      // Playback Control
      play: () => mockTrackPlayerPlay(),
      pause: () => mockTrackPlayerPause(),
      seekTo: (pos: number) => mockTrackPlayerSeekTo(pos),
      setRate: (rate: number) => mockTrackPlayerSetRate(rate),
      setVolume: (volume: number) => mockTrackPlayerSetVolume(volume),
      // Queue Management
      reset: () => mockTrackPlayerReset(),
      add: (track: unknown) => mockTrackPlayerAdd(track),
      // State Queries
      getProgress: () => mockTrackPlayerGetProgress(),
      getPlaybackState: () => mockTrackPlayerGetPlaybackState(),
      getPlayWhenReady: () => mockTrackPlayerGetPlayWhenReady(),
      getRate: () => mockTrackPlayerGetRate(),
      // Event Listeners
      addEventListener: (event: string, handler: unknown) =>
        mockTrackPlayerAddEventListener(event, handler as () => void),
      // Setup
      setupPlayer: (options: unknown) => mockTrackPlayerSetupPlayer(options),
      updateOptions: (options: unknown) =>
        mockTrackPlayerUpdateOptions(options),
      registerPlaybackService: (factory: unknown) =>
        mockTrackPlayerRegisterPlaybackService(factory),
    },
    // Named exports (enums)
    Event,
    State,
    Capability,
    AndroidAudioContentType,
    IOSCategory,
    IOSCategoryMode,
    PitchAlgorithm,
    TrackType,
    // React hooks
    useIsPlaying: jest.fn(() => ({
      playing: false,
      bufferingDuringPlay: false,
    })),
    usePlaybackState: jest.fn(() => ({ state: State.None })),
    useProgress: jest.fn(() => ({ position: 0, duration: 0, buffered: 0 })),
  };
});

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
// Activity Tracker Fake (Native Module)
// =============================================================================
// Like TrackPlayer, we use a "fake" instead of mocks - a working implementation
// that maintains internal state. Tests verify observable outcomes (isStationary
// state changes) rather than checking if functions were called.
//
// Note: Variable must be prefixed with "mock" for jest.mock() to access it.

interface MockActivityTrackerFakeState {
  isTracking: boolean;
  permissionStatus: string;
  listener: ((event: MockActivityStateEvent) => void) | null;
}

interface MockActivityStateEvent {
  state: "STATIONARY" | "NOT_STATIONARY";
  confidence: "LOW" | "MEDIUM" | "HIGH";
  timestamp: number;
}

const mockCreateInitialActivityTrackerState =
  (): MockActivityTrackerFakeState => ({
    isTracking: false,
    permissionStatus: "AUTHORIZED",
    listener: null,
  });

let mockActivityTrackerState = mockCreateInitialActivityTrackerState();

/**
 * Reset the ActivityTracker fake to initial state. Call in beforeEach().
 */
export function resetActivityTrackerFake() {
  mockActivityTrackerState = mockCreateInitialActivityTrackerState();
}

/**
 * Control the ActivityTracker fake for test setup.
 */
export const activityTrackerFake = {
  getState() {
    return { ...mockActivityTrackerState };
  },

  /**
   * Set permission status for testing permission flows.
   */
  setPermissionStatus(status: string) {
    mockActivityTrackerState.permissionStatus = status;
  },

  /**
   * Simulate an activity state change from the native module.
   * This is how tests should trigger isStationary changes.
   */
  simulateActivityStateChange(
    state: "STATIONARY" | "NOT_STATIONARY",
    confidence: "LOW" | "MEDIUM" | "HIGH" = "HIGH",
  ) {
    if (
      mockActivityTrackerState.listener &&
      mockActivityTrackerState.isTracking
    ) {
      mockActivityTrackerState.listener({
        state,
        confidence,
        timestamp: Date.now(),
      });
    }
  },
};

jest.mock("activity-tracker", () => ({
  ActivityState: {
    STATIONARY: "STATIONARY",
    NOT_STATIONARY: "NOT_STATIONARY",
  },
  PermissionStatus: {
    AUTHORIZED: "AUTHORIZED",
    DENIED: "DENIED",
    RESTRICTED: "RESTRICTED",
    NOT_DETERMINED: "NOT_DETERMINED",
    UNAVAILABLE: "UNAVAILABLE",
  },
  TrackingStatus: {
    STARTED: "STARTED",
    STOPPED: "STOPPED",
    UNAUTHORIZED: "UNAUTHORIZED",
    FAILED: "FAILED",
  },
  Confidence: {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
  },
  getPermissionStatus: () => {
    return Promise.resolve(mockActivityTrackerState.permissionStatus);
  },
  requestPermission: () => {
    // Simulate permission request - if not determined, assume user grants
    if (mockActivityTrackerState.permissionStatus === "NOT_DETERMINED") {
      mockActivityTrackerState.permissionStatus = "AUTHORIZED";
    }
    return Promise.resolve(mockActivityTrackerState.permissionStatus);
  },
  startTracking: () => {
    if (
      mockActivityTrackerState.permissionStatus !== "AUTHORIZED" &&
      mockActivityTrackerState.permissionStatus !== "NOT_DETERMINED"
    ) {
      return Promise.resolve("UNAUTHORIZED");
    }
    mockActivityTrackerState.isTracking = true;
    return Promise.resolve("STARTED");
  },
  stopTracking: () => {
    mockActivityTrackerState.isTracking = false;
    mockActivityTrackerState.listener = null;
    return Promise.resolve("STOPPED");
  },
  addActivityStateListener: (
    listener: (event: MockActivityStateEvent) => void,
  ) => {
    mockActivityTrackerState.listener = listener;
    return {
      remove: () => {
        mockActivityTrackerState.listener = null;
      },
    };
  },
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
