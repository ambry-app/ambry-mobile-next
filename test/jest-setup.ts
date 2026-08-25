/**
 * Jest setup file - runs before each test file.
 */
import { resetForTesting as resetTrackPlayerWrapper } from "@/services/track-player-wrapper";

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
// Audio Player Fake (Native Module)
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
  queue: unknown[];
  activeTrackIndex: number | undefined;
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
  // A recording can be several files. The fake tracks the whole queue and
  // which file is active, because that is exactly the state the wrapper's
  // book-position translation depends on.
  queue: [] as unknown[],
  activeTrackIndex: undefined as number | undefined,
});

let trackPlayerState = createInitialState();

// Track pending async event emissions so we can cancel them on reset
let pendingEventEmissions: NodeJS.Immediate[] = [];

function emitSnapshotEvent() {
  emitAudioPlayerEvent("onStateChange", nativeSnapshot());
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
  // The wrapper dedupes state emissions against what it last saw; a fresh
  // fake needs that memory gone or a test's first emission can be swallowed.
  resetTrackPlayerWrapper();
}

/**
 * Control the TrackPlayer fake state for test setup.
 *
 * Usage:
 *   trackPlayerFake.setState({ duration: 300, position: 50 });
 */
export const trackPlayerFake = {
  setState(partial: Partial<TrackPlayerFakeState>) {
    Object.assign(trackPlayerState, partial);
    // The wrapper reads a mirror of the last emitted snapshot, so a state
    // poke has to emit one or the code under test never sees it.
    emitSnapshotEvent();
  },

  getState() {
    return { ...trackPlayerState };
  },

  emitQueueEnded() {
    emitAudioPlayerEvent("onQueueEnded", undefined);
  },

  // Simulate external events (e.g., system interruption)
  emitPlaybackStateChange(state: string) {
    trackPlayerState.playbackState = state;
    emitSnapshotEvent();
  },

  emitPlayWhenReadyChange(playWhenReady: boolean) {
    trackPlayerState.playWhenReady = playWhenReady;
    emitSnapshotEvent();
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
export const mockTrackPlayerSkip = jest.fn(
  async (index: number, initialPosition?: number) => {
    trackPlayerState.activeTrackIndex = index;
    trackPlayerState.currentTrack = trackPlayerState.queue[index] ?? null;

    const track = trackPlayerState.queue[index];
    if (track && typeof track === "object" && "duration" in track) {
      trackPlayerState.duration = (track as { duration: number }).duration;
    }

    trackPlayerState.position = initialPosition ?? 0;
  },
);
export const mockTrackPlayerGetActiveTrackIndex = jest.fn(
  async () => trackPlayerState.activeTrackIndex,
);
export const mockTrackPlayerPlay = jest.fn(async () => {
  trackPlayerState.playWhenReady = true;
  trackPlayerState.playbackState = "playing";
  // Emit events asynchronously like the real native module does.
  // Native events fire AFTER the JS call returns, not synchronously within it.
  // This is important for testing race conditions between event handlers.
  scheduleEventEmission(emitSnapshotEvent);
});
export const mockTrackPlayerPause = jest.fn(async () => {
  trackPlayerState.playWhenReady = false;
  trackPlayerState.playbackState = "paused";
  // Emit events asynchronously like the real native module does.
  scheduleEventEmission(emitSnapshotEvent);
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
  trackPlayerState.queue = [];
  trackPlayerState.activeTrackIndex = undefined;
  trackPlayerState.playWhenReady = false;
  trackPlayerState.playbackState = "none";
});
export const mockTrackPlayerAdd = jest.fn(async (tracks: unknown) => {
  const added = Array.isArray(tracks) ? tracks : [tracks];
  trackPlayerState.queue = added;
  trackPlayerState.activeTrackIndex = added.length > 0 ? 0 : undefined;

  const track = added[0] ?? null;
  trackPlayerState.currentTrack = track;
  // The player reports the duration of the file it is playing, not of the book
  if (track && typeof track === "object" && "duration" in track) {
    trackPlayerState.duration = (track as { duration: number }).duration;
  }
  // Simulate the real native module: adding a track causes playback state
  // to transition through Loading -> Ready.
  //
  // We emit synchronously here (not via setImmediate) so that tests can catch
  // race conditions where code after add() overwrites the state set by event
  // listeners. In real native code, events fire during the await and are
  // processed before subsequent synchronous code runs.
  trackPlayerState.playbackState = "ready";
  emitSnapshotEvent();
});
export const mockTrackPlayerSetupPlayer = jest.fn();

type MockAudioPlayerListener = (payload: any) => void;

// Survives resetTrackPlayerFake() on purpose: the wrapper hooks native events
// once per JS context, exactly as in production, so wiping registrations
// between tests would deafen every test in a file after the first.
const mockAudioPlayerListeners = new Map<string, MockAudioPlayerListener[]>();

function emitAudioPlayerEvent(name: string, payload?: unknown) {
  const listeners = mockAudioPlayerListeners.get(name) ?? [];
  listeners.forEach((listener) => listener(payload));
}

/** The fake's RNTP-ish state string, as the native module's coarser state. */
function nativeStateOf(playbackState: string): string {
  switch (playbackState) {
    case "buffering":
    case "loading":
      return "buffering";
    case "ended":
      return "ended";
    case "playing":
    case "paused":
    case "ready":
      return "ready";
    default:
      return "idle";
  }
}

function nativeSnapshot() {
  return {
    state: nativeStateOf(trackPlayerState.playbackState),
    playing: trackPlayerState.playbackState === "playing",
    playWhenReady: trackPlayerState.playWhenReady,
    index: trackPlayerState.activeTrackIndex ?? 0,
    positionSeconds: trackPlayerState.position,
    durationSeconds: trackPlayerState.duration,
    bufferedSeconds: trackPlayerState.buffered,
    rate: trackPlayerState.rate,
  };
}

const mockAudioPlayerNative = {
  addListener(name: string, listener: MockAudioPlayerListener) {
    const listeners = mockAudioPlayerListeners.get(name) ?? [];
    listeners.push(listener);
    mockAudioPlayerListeners.set(name, listeners);
    return { remove: () => {} };
  },
  setup: async () => mockTrackPlayerSetupPlayer(),
  setQueue: async (tracks: unknown[]) => mockTrackPlayerAdd(tracks),
  play: async () => mockTrackPlayerPlay(),
  pause: async () => mockTrackPlayerPause(),
  // The native seek is atomic over (file, position); the legacy mocks split it
  // the way RNTP did, and tests assert against that split.
  seekTo: async (index: number, seconds: number) => {
    if (index === (trackPlayerState.activeTrackIndex ?? 0)) {
      await mockTrackPlayerSeekTo(seconds);
    } else {
      await mockTrackPlayerSkip(index, seconds);
    }
  },
  setRate: async (rate: number) => {
    await mockTrackPlayerSetRate(rate);
  },
  setVolume: async (volume: number) => {
    await mockTrackPlayerSetVolume(volume);
  },
  reset: async () => mockTrackPlayerReset(),
  // Composed from the getter mocks so a test's mockImplementation on any of
  // them still shapes what the wrapper sees.
  getState: async () => {
    const progress = await mockTrackPlayerGetProgress();
    const { state } = await mockTrackPlayerGetPlaybackState();
    const playWhenReady = await mockTrackPlayerGetPlayWhenReady();
    const rate = await mockTrackPlayerGetRate();
    const index = (await mockTrackPlayerGetActiveTrackIndex()) ?? 0;

    return {
      state: nativeStateOf(state),
      playing: state === "playing",
      playWhenReady,
      index,
      positionSeconds: progress.position,
      durationSeconds: progress.duration,
      bufferedSeconds: progress.buffered,
      rate,
    };
  },
};

jest.mock("audio-player", () => ({
  getAudioPlayer: () => mockAudioPlayerNative,
}));

/**
 * Simulate the native side of the audio player.
 */
export const audioPlayerFake = {
  /**
   * A lock-screen, notification or media-key press, delivered the way the
   * module delivers it: un-acted, as an event. Nothing has happened to the
   * player when this fires - JS is the actor.
   */
  emitRemoteCommand(command: { command: string; [key: string]: unknown }) {
    emitAudioPlayerEvent("onRemoteCommand", command);
  },
};

// =============================================================================
// Expo FileSystem Mock
// =============================================================================

/**
 * Files the code under test has deleted. Tracked so that `exists` reflects
 * reality, which lets tests assert on filesystem outcomes (e.g. that a
 * cancelled download's leftover file was cleaned up) rather than on whether
 * `delete()` happened to be called.
 */
const deletedFiles = new Set<string>();

/**
 * A direct-play recording downloads into a folder of its own, so the fake has
 * to model directories as well as files.
 */
const createdDirectories = new Set<string>();

class MockDirectory {
  uri: string;

  constructor(base: { uri: string } | string, ...segments: string[]) {
    const baseUri = typeof base === "string" ? base : base.uri;
    this.uri = [baseUri.replace(/\/+$/, ""), ...segments].join("/");
  }

  get exists() {
    return createdDirectories.has(this.uri) && !deletedFiles.has(this.uri);
  }

  create(_options?: { intermediates?: boolean; idempotent?: boolean }) {
    createdDirectories.add(this.uri);
    deletedFiles.delete(this.uri);
  }

  delete() {
    deletedFiles.add(this.uri);
    createdDirectories.delete(this.uri);
  }
}

class MockFile {
  uri: string;
  size: number = 1024;

  constructor(uri: string) {
    this.uri = uri;
  }

  get parentDirectory() {
    return new MockDirectory(this.uri.split("/").slice(0, -1).join("/"));
  }

  get exists() {
    return !deletedFiles.has(this.uri);
  }

  delete() {
    deletedFiles.add(this.uri);
  }

  static async downloadFileAsync(_url: string, path: any, options?: any) {
    // A cancelled transfer rejects, the same way an aborted fetch does
    if (options?.signal?.aborted) {
      const error = new Error("Aborted");
      error.name = "AbortError";
      throw error;
    }

    // Report progress the way the native module does: some way through, then
    // complete. Tests that care about the shape of aggregate progress need
    // more than one callback per file.
    options?.onProgress?.({ bytesWritten: 512, totalBytes: 1024 });
    options?.onProgress?.({ bytesWritten: 1024, totalBytes: 1024 });

    // Writing a file brings it back into existence
    deletedFiles.delete(path.uri);
    return path;
  }
}

jest.mock("expo-file-system", () => ({
  Paths: {
    document: {
      uri: "file:///test-document-directory/",
    },
  },
  File: MockFile,
  Directory: MockDirectory,
}));

/** True if the file at `uri` has not been deleted by the code under test. */
export function mockFileExists(uri: string): boolean {
  return !deletedFiles.has(uri);
}

/**
 * Simulate a file appearing on disk. Needed when a test replaces
 * `File.downloadFileAsync` with its own mock, since that bypasses the default
 * implementation which would otherwise record the write.
 */
export function mockFileWritten(uri: string): void {
  deletedFiles.delete(uri);
}

/** Forget all recorded deletions. Call between tests. */
export function resetMockFileSystem(): void {
  deletedFiles.clear();
  createdDirectories.clear();
}

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

// =============================================================================
// Sentry (Native Module)
// =============================================================================
// @sentry/core ships untranspiled ESM, so importing the real SDK fails under
// jest. Crash reporting has no observable behaviour to test anyway.

export const mockSentryCaptureException = jest.fn();

jest.mock("@sentry/react-native", () => ({
  captureException: (error: unknown) => mockSentryCaptureException(error),
  init: jest.fn(),
  wrap: (component: unknown) => component,
  reactNavigationIntegration: () => ({
    registerNavigationContainer: jest.fn(),
  }),
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
// Expo Application Mock
// =============================================================================

jest.mock("expo-application", () => ({
  applicationId: "app.ambry.mobile.test",
  nativeApplicationVersion: "1.0.0",
  nativeBuildVersion: "1",
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
