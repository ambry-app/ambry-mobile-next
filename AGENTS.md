# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## Project Overview

Ambry is a React Native/Expo mobile app (iOS & Android) for streaming and downloading audiobooks from a self-hosted server. The app provides offline playback, library browsing, and syncs playback progress across devices.

## Development Commands

### Running the App

```bash
npm start                    # Start Expo dev server
npm run ios                  # Run on iOS simulator
npm run android              # Run on Android emulator/device
npm run prebuild             # Generate native code (when needed)
npm run prebuild -- --clean  # Clean rebuild of native code
```

**CRITICAL**: Always use `npm run` scripts instead of running `npx expo` directly. The npm scripts set `APP_VARIANT=development` which configures the correct package name (`app.ambry.mobile.dev`) and app name (`Ambry (Dev)`). Running `npx expo prebuild` or `npx expo run:android` directly will use the production package name (`app.ambry.mobile`) and cause installation conflicts.

### Code Generation & Database

```bash
npm run codegen              # Generate GraphQL types from server schema
npm run codegen-watch        # Watch mode for GraphQL codegen
npm run generate-migrations  # Generate Drizzle ORM migrations after schema changes
```

### Quality & Diagnostics

```bash
npm run lint                 # Run ESLint (includes Prettier formatting checks)
npm run lint:fix             # Auto-fix ESLint and formatting issues
npx tsc                      # Type check (run after changes)
npm test                     # Run Jest tests once (for CI/scripts)
npm run test:watch           # Run Jest tests in watch mode
npm run test:coverage        # Run Jest tests with coverage reporting
npm run doctor               # Check Expo environment health
```

**Important**: After making code changes, always run `npx tsc` to check for type errors and `npm run lint` to verify linting and formatting. Use `npm run lint:fix` to auto-fix issues before committing.

### Building

```bash
npm run android-preview      # Build Android preview locally with EAS
npm run ios-preview          # Build iOS preview locally with EAS
```

## Architecture Overview

### Technology Stack

- **React Native 0.81.5** with **Expo ~54.0.31**
- **React 19.1.0**
- **Expo Router ~6.0.21**: File-based routing
- **Zustand 5.0.5**: Global state management
- **Drizzle ORM ^0.45.1** with **Expo SQLite**: Local database
- **react-native-track-player 5.0.0-alpha0**: Background audio playback
- **GraphQL**: Custom client with code generation for type safety
- **react-native-logs**: Structured logging with color-coded extensions

### Core Directories

- **`/src/app/`**: Expo Router file-based routing. Each file is a route, `_layout.tsx` files define navigation structure
- **`/src/components/`**: Reusable UI components. Complex screens in `screens/` subdirectory with modular organization
- **`/src/stores/`**: Zustand stores for global state
- **`/src/services/`**: Business logic and background services (playback, sync, downloads, etc.)
- **`/src/db/`**: Drizzle ORM schema and data access layer
  - `schema.ts`: Complete database schema
  - `sync.ts`: Database-level sync helpers
  - `library/`: Query functions organized by entity type
  - `playthroughs.ts`: Playthrough database operations
- **`/drizzle/`**: Generated database migrations (run `npm run generate-migrations` after schema changes)
- **`/src/graphql/`**: GraphQL API layer
  - `api.ts`: High-level API functions
  - `client/`: Generated types and execution logic
- **`/src/utils/`**: Utility functions (hooks, time formatting, paths, logging, subscriptions)
- **`/src/styles/`**: Design system colors and style utilities

### State Management Pattern

**Zustand Stores** (not Redux, not Context):

- **`device.ts`**: Device info (id, type, brand, model, OS) - ID persisted to SecureStore
- **`session.ts`**: Authentication state (email, token, server URL) - persisted to SecureStore
- **`data-version.ts`**: Library data versioning and sync timestamps
- **`downloads.ts`**: Download management and progress tracking
- **`sleep-timer.ts`**: Sleep timer state (duration, enabled, trigger time)
- **`track-player.ts`**: Core audio player state (playback state, progress, chapters, seek/play-pause events)
- **`player-ui-state.ts`**: UI-specific player state (loading, expanded state)
- **`seek-ui-state.ts`**: Seeking UI state (seeking position, direction)
- **`screen.ts`**: UI state (dimensions, keyboard visibility)
- **`debug.ts`**: Debug mode toggle

**Store Initialization Pattern:**
Most stores follow a consistent initialization pattern:

- Each has an `initialized: boolean` flag
- Each exports an `initialize*()` async function (usually in a service)
- Initialize functions check the flag and skip if already initialized
- This enables efficient app resume when JS context persists (see JS Context Architecture)

**Access pattern:** Import and use directly

```typescript
import { useSession } from "@/stores/session";

const { email, token } = useSession();
const logout = useSession((state) => state.logout);
```

**Subscribing to store changes in services:**

```typescript
import { subscribeToChange } from "@/utils/subscribe";

subscribeToChange(
  useTrackPlayer,
  (s) => s.lastPlayPause,
  (event) => handlePlayPauseEvent(event),
);
```

### Services Architecture

Services contain business logic and are decoupled via store subscriptions (using `subscribeToChange` from `@/utils/subscribe`):

**Playback Services:**

- **`track-player-service.ts`**: Core TrackPlayer integration. Owns `track-player` store. Handles play/pause/seek, progress tracking, loading playthroughs into TrackPlayer.
- **`playback-service.ts`**: Registered in `entry.js`. Handles TrackPlayer events (remote play/pause, jump forward/backward, queue end).
- **`playback-controls.ts`**: High-level playback API. Coordinates loading media, finishing/abandoning playthroughs, player UI expansion.
- **`seek-service.ts`**: Handles user-initiated seeking with accumulation. Owns `seek-ui-state` store. Prevents overwhelming TrackPlayer with rapid seeks.
- **`chapter-service.ts`**: Chapter navigation logic.
- **`sleep-timer-service.ts`**: Sleep timer with volume fade and auto-pause.

**Progress & Sync Services:**

- **`event-recording.ts`**: Records playback events (play, pause, seek, rate change) to database. Subscribes to `track-player` store changes. Debounces events to reduce noise.
- **`position-heartbeat.ts`**: Periodically saves playback position to database.
- **`sync-service.ts`**: Handles library and playthrough sync with server. Exports `sync()`, `syncLibrary()`, `syncPlaythroughs()`, and hooks like `useForegroundSync()`, `usePullToRefresh()`.
- **`background-sync-service.ts`**: Background task for periodic sync.

**Data Services:**

- **`playthrough-operations.ts`**: Playthrough CRUD operations (create, continue, finish, abandon, delete).
- **`library-service.ts`**: Library data access.
- **`shelf-service.ts`**: User shelf operations.
- **`download-service.ts`**: Download management with progress tracking.
- **`data-version-service.ts`**: Manages data version store initialization.

**Infrastructure Services:**

- **`boot-service.ts`**: App boot sequence. Exports `useAppBoot()` hook.
- **`db-service.ts`**: Database initialization and migrations.
- **`session-service.ts`**: Session access utilities.
- **`auth-service.ts`**: Authentication logic.
- **`track-player-wrapper.ts`**: Thin wrapper around TrackPlayer native module with logging.

### Audio Playback Architecture

**Background Audio Service**:

- Uses `react-native-track-player` (alpha version)
- Service registered in `entry.js` before app renders
- Runs as Android foreground service with persistent notification
- Service code: `src/services/playback-service.ts`
- Handles TrackPlayer events and delegates to appropriate services
- Remote control events (lock screen, headphones) handled via TrackPlayer events

**JS Context Architecture** (tested and confirmed):

- TrackPlayer's foreground service keeps the **same JS context alive** even when app is swiped away
- All modules (stores, services) share the same runtime instance
- Module-level variables, timers, and store subscriptions persist across app "kills"
- Force-stopping via Android Settings kills the foreground service entirely (no remote playback possible)
- There is effectively **no dual-context scenario** in practice - the only way to trigger playback is to launch the app, which shares the existing context

**Important**: Because the JS context persists, Zustand stores and module-level variables survive app "kills". If state appears to be lost, the likely cause is the **app boot sequence resetting it**, not context separation. The sleep timer is a good example: `sleepTimerTriggerTime` lives only in Zustand (not DB) and survives app kills because we don't reset it on boot. User preferences (duration, enabled) are persisted to DB, but transient runtime state (trigger time) stays in memory.

**Player State Architecture:**

State is split across three stores by responsibility:

- **`track-player.ts`**: Core playback state needed by all services (progress, playback state, rate, chapters, event tracking for lastSeek/lastPlayPause/lastRateChange)
- **`player-ui-state.ts`**: UI-only state (loading indicator, expanded state)
- **`seek-ui-state.ts`**: Seeking UI state (seek position during scrubbing, direction indicator)

**Critical**: When modifying player logic, understand the seek accumulation pattern:

- Multiple rapid seeks accumulate before applying (750ms window)
- Prevents jitter and excessive native calls
- See `seek-service.ts` for implementation

### Database Architecture

**SQLite with Drizzle ORM**:

- Write-Ahead Logging (WAL) mode enabled for performance
- Multi-tenant design: Every table includes `url` (server URL) in composite keys
- Supports multiple server connections in one database

**Key Tables**:

- **Library tables**: `people`, `authors`, `narrators`, `books`, `media`, `series` (synced from server)
- **Playback progress**: `playthroughs` (listening sessions), `playbackEvents` (event-sourced history)
- **Downloads**: `downloads` (local file paths, resumable state)
- **User data**: `localUserSettings`, `shelvedMedia`
- **Sync metadata**: `syncedServers`, `serverProfiles` (timestamps for incremental sync)

**Event-Sourced Playback Progress**:

- **`playthroughs`**: Listening sessions for media (one per listen, status: in_progress/finished/abandoned)
- **`playbackEvents`**: Immutable event log (play, pause, seek, rate_change, finish, abandon)
- **`playthroughStateCache`**: Materialized view of current position/rate (rebuilt from events)
- Events recorded in real-time via `event-recording.ts`
- Bidirectional sync via `syncPlaythroughs()` - sends unsynced events, receives server state
- Server is authoritative for completed/abandoned playthroughs
- See `db/playthroughs.ts` for event recording and state reconstruction logic

**Schema Changes**:

1. Modify `src/db/schema.ts`
2. Run `npm run generate-migrations`
3. Migrations auto-apply on next app boot

### GraphQL API Layer

**Custom Client** (not Apollo, not URQL):

- Raw `fetch` API with type-safe generated types
- Result pattern for error handling (no throwing)
- All queries/mutations in `src/graphql/api.ts`
- Generated types in `src/graphql/client/`

**Code Generation**:

- Scans all `src/**/*.{ts,tsx}` for `graphql()` calls
- Generates type-safe functions with `graphql-codegen`
- Schema source: `http://localhost:4000/gql` (update in `codegen.ts` if needed)
- Run `npm run codegen` after adding new queries

**Error Handling Pattern**:

```typescript
const result = await executeAuthenticated(url, token, query, variables);
if (!result.success) {
  switch (result.error.code) {
    case ExecuteAuthenticatedErrorCode.UNAUTHORIZED:
    // Handle auth error
    case ExecuteAuthenticatedErrorCode.NETWORK_ERROR:
    // Handle network
    // etc.
  }
  return;
}
const data = result.result; // Type-safe success path
```

### Data Synchronization

**Main Sync Function** (`services/sync-service.ts`):

The `sync(session)` function performs both library and playthrough sync in parallel:

**Library Sync** (`syncLibrary`):

1. Query `getLibraryChangesSince(lastDownSync)` - single large query for all entity types
2. Transform GraphQL data to database schema
3. Upsert all records in single transaction
4. Handle deletions
5. Update `lastDownSync` and `newDataAsOf` timestamps in `syncedServers` table

**Playthrough Sync** (`syncPlaythroughs` - bidirectional):

1. Send unsynced playthroughs and events to server via `syncProgress` mutation
2. Receive server-authoritative playthroughs and events in same response
3. Upsert received playthroughs and events to local database
4. Mark sent items as synced (`syncedAt` timestamp)
5. Update state cache for any position changes
6. Update `lastDownSync` timestamp in `serverProfiles` table

**Sync Timing**:

- Initial sync on first login (blocks app)
- Foreground sync: Every 15 minutes (see `useForegroundSync` hook in sync-service)
- Background sync: Every 15 minutes minimum (see `background-sync-service.ts`)
- Manual sync: Pull-to-refresh on library screens (see `usePullToRefresh` hook)

**Cache Invalidation**:

- Global `libraryDataVersion` and `playthroughDataVersion` in data-version store
- UI components refetch on version change
- After sync completes: `setLibraryDataVersion(new Date())` or `bumpPlaythroughDataVersion()`

### Navigation & Routing

**File-based with Expo Router**:

- `app/_layout.tsx`: Root layout with auth guards
- `app/sign-in.tsx`: Sign-in screen (unauthenticated)
- `app/(tabs)/`: Protected tab navigation
  - `(home)/`: Home tab with nested routing
    - `index.tsx`: Home screen
    - `downloads.tsx`, `settings.tsx`: Tab screens
    - `(library)/`: Library stack (search, browse)
    - `(shelf)/`: User shelf stack (in-progress, finished, saved)
  - `book/[id].tsx`, `media/[id].tsx`, `author/[id].tsx`, etc.: Detail screens (direct children of tabs)
- Modal screens at root: `sleep-timer.tsx`, `playback-rate.tsx`, `chapter-select.tsx`

**Authentication Guards**:

- `Stack.Protected` wrapper checks `isLoggedIn` state
- Auto-redirect to `sign-in.tsx` if not authenticated
- Player modals additionally guard on `playerLoaded` state

**Navigation Pattern**:

```typescript
import { router } from "expo-router";
router.push("/book/123");
router.back();
```

### App Initialization Flow

**Boot Sequence** (`services/boot-service.ts` - `useAppBoot` hook):

1. Apply database migrations (Drizzle `useMigrations` hook in db-service)
2. Check session (exit early if none)
3. `initializeDevice()` - Load/create device ID from SecureStore
4. `initializeDataVersion(session)` - Load sync timestamps, returns `{ needsInitialSync }`
5. Initial sync if needed (`sync(session)`)
6. `initializeDownloads(session)` - Load download states from DB
7. `initializeTrackPlayer()` - Setup TrackPlayer native module
8. `initializePlayer(session)` - Load most recent media into player
9. `initializeSleepTimer(session)` - Load sleep timer preferences from DB
10. `initializeHeartbeat()` - Start position heartbeat service
11. `initializeEventRecording()` - Start event recording service
12. Register background sync task
13. Set ready (hide splash screen)

**Key behavior**: Each `initialize*()` function checks its store's `initialized` flag and skips if already initialized. This enables efficient app resume when JS context persists - stores already have correct state from before app was "killed", so no redundant DB queries occur.

**Critical**: Modifications to boot flow must maintain order - some steps depend on previous steps (e.g., sync needs data version, player may need device info).

## Important Patterns & Conventions

### Result Pattern for Error Handling

Instead of throwing exceptions, functions return `Result<T, E>` discriminated unions:

```typescript
type Result<T, E> = { success: true; result: T } | { success: false; error: E };
```

This forces exhaustive error handling at call sites.

### Store Subscriptions for Cross-Service Communication

Simple subscription pattern (`utils/subscribe.ts`):

- Decouples services from each other
- Services subscribe to store changes rather than calling each other directly
- Key events tracked via store fields: `lastPlayPause`, `lastSeek`, `lastRateChange` in track-player store
- Services react to changes and handle their own concerns
- Works reliably since all code runs in the same JS context (see JS Context Architecture above)

### Type Inference from Queries

Drizzle queries infer complex types automatically:

```typescript
const getMedia = async (id: string) => db.query.media.findFirst({...})
export type Media = Awaited<ReturnType<typeof getMedia>>
```

Schema changes cascade automatically - be aware of breaking changes.

### Multi-Server Support

Every database query scoped by server URL:

```typescript
where: and(eq(table.url, session.url), eq(table.id, id));
```

Never query without URL filter in multi-tenant tables.

### File Paths

All file operations use document directory:

- Downloads: `{documentDirectory}/{mediaId}.mp4`
- Thumbnails: `{documentDirectory}/{mediaId}-{size}.webp`
- Use `utils/paths.ts` helpers: `documentDirectoryFilePath()`

### Component Organization

Complex screens get subdirectories:

```
components/screens/
  media-screen/
    index.ts          # Exports all parts
    ActionBar.tsx
    Header.tsx
    MediaDescription.tsx
```

### Constants and Configuration

Timing constants centralized in `src/constants.ts`:

- `SEEK_ACCUMULATION_WINDOW`: Debounce window for rapid seeks (750ms)
- `SEEK_EVENT_ACCUMULATION_WINDOW`: Delay before logging seek events (5s)
- `PLAY_PAUSE_EVENT_ACCUMULATION_WINDOW`: Delay before logging play/pause events (2s)
- `RATE_CHANGE_EVENT_ACCUMULATION_WINDOW`: Delay before logging rate changes (2s)
- `PROGRESS_SAVE_INTERVAL`: How often to save position during playback (30s)
- `SLEEP_TIMER_FADE_OUT_TIME`: Duration of volume fade before sleep timer triggers (30s)
- `PAUSE_REWIND_SECONDS`: Seconds to rewind when pausing (1s, multiplied by rate)
- `SLEEP_TIMER_PAUSE_REWIND_SECONDS`: Seconds to rewind on sleep timer pause (10s)
- `FOREGROUND_SYNC_INTERVAL`: Periodic foreground sync interval (15 minutes)

Keep all timing/interval constants here for easy adjustment.

### Logging

Uses `react-native-logs` with color-coded extensions (`utils/logger/`):

```typescript
import { logBase } from "@/utils/logger";
const log = logBase.extend("my-module");

log.info("User action happened");
log.debug("Implementation detail");
```

**Log Level Guidelines:**

| Level | When to Use                                                 | Examples                                      |
| ----- | ----------------------------------------------------------- | --------------------------------------------- |
| error | Unexpected failures, caught exceptions indicating bugs      | Failed to load media, sync failed             |
| warn  | Recoverable issues, degraded functionality                  | Retry needed, fallback used, missing data     |
| info  | Significant mutations/actions (DB writes, state changes)    | "Recorded play event", "Loading playthrough"  |
| debug | Implementation details, skipped actions, downstream effects | "Skipping debounced event", state transitions |
| silly | Very spammy, usually disabled during development            | Progress ticks, frequent polling results      |

Extensions are color-coded by functional area (playback=purple, sync=blue, downloads=orange, etc.).

### Time Display: Book Time vs Real Time

The app displays time in two ways:

- **Book time**: Actual position/duration in the audiobook (unaffected by playback rate)
- **Real time**: Adjusted for playback rate (e.g., 1 hour at 2x speed = 30 min real time)

**General pattern**: "Where am I" = book time, "How long until X" = real time.

| Location                         | What's Displayed           | Time Type | Notes                       |
| -------------------------------- | -------------------------- | --------- | --------------------------- |
| PlayerProgressBar (left)         | Current position           | Book      |                             |
| PlayerProgressBar (right)        | Remaining time             | Real      | `remaining / rate`          |
| Scrubber timecode                | Position while scrubbing   | Book      |                             |
| SeekIndicator (button seeks)     | Seek diff (+/-)            | Real      | User pressed "rewind 1 min" |
| SeekIndicator (scrubber seeks)   | Seek diff (+/-)            | Book      | Dragging on book timeline   |
| PlaythroughHistory (now playing) | "X left"                   | Real      | `remaining / rate`          |
| PlaythroughHistory (in_progress) | "X left" for saved         | Real      | `remaining / savedRate`     |
| PlaythroughHistory (abandoned)   | Saved position             | Book      |                             |
| Chapter select                   | Chapter start times        | Book      |                             |
| Playback rate modal              | "Finish in X"              | Real      | `remaining / rate`          |
| Resume prompt                    | "Your last position was X" | Book      |                             |
| Media header                     | Total duration             | Book      | "5 hours and 30 minutes"    |
| Sleep timer                      | Duration/countdown         | Timer     | Not playback-related        |

**Time formatting utilities** (`src/utils/time.ts`):

- `secondsDisplay()`: Formats as "H:MM:SS" or "M:SS"
- `secondsDisplayMinutesOnly()`: Always "M:SS", supports +/- prefix
- `durationDisplay()`: Descriptive phrase like "5 hours and 30 minutes"

## Testing

**Framework**: Jest with `jest-expo` preset.

### Testing Philosophy: Detroit-Style (Classical) Testing

We follow **Detroit-style testing** (also called "Classical" or "Sociable" testing), as opposed to London-style (Mockist/Solitary) testing:

| Approach                  | Philosophy                               | Mocking Strategy               |
| ------------------------- | ---------------------------------------- | ------------------------------ |
| **Detroit (Classical)** ✓ | Test behavior through real collaborators | Only mock at system boundaries |
| **London (Mockist)**      | Isolate units completely                 | Mock all dependencies          |

**Our approach**: Use real implementations of our own code. Only mock external dependencies that are truly outside our control:

- **DO mock**: Native modules (expo-secure-store, expo-file-system, expo-device), GraphQL network layer (`fetch`)
- **DO NOT mock**: Our own code (stores, database modules, utilities, GraphQL API functions)

**Why Detroit-style?**

- Catches real integration issues between modules
- Tests actual behavior, not implementation details
- Refactoring internals doesn't break tests
- Higher confidence that the system works as a whole

**Example**: When testing `sync.ts`, we use the real session store, real database modules, and real GraphQL API functions. We only mock the `fetch` call that actually hits the network. This tests the entire sync flow, not just that `sync.ts` calls the right functions with the right arguments.

### Test Outcomes, Not Implementation Details

**Avoid testing HOW code works internally.** Instead, test WHAT it produces (observable outcomes).

This applies to:

- `jest.spyOn()` - avoid unless truly necessary
- `expect(mock).toHaveBeenCalled()` - avoid if you can verify the outcome instead
- `expect(mock).toHaveBeenCalledWith(...)` - same principle

These assertions test implementation details, making tests brittle - they break when you refactor internals even if behavior is unchanged.

**Bad** - Testing implementation:

```typescript
// Tests that a function was called, not that the result is correct
await trackPlayerService.play(PlayPauseSource.USER);
expect(mockTrackPlayerPlay).toHaveBeenCalled();
```

**Good** - Verifying observable outcome:

```typescript
// Tests the actual result - state changed correctly
await trackPlayerService.play(PlayPauseSource.USER);
expect(useTrackPlayer.getState().lastPlayPause?.type).toBe(PlayPauseType.PLAY);
```

**When `.toHaveBeenCalled()` is acceptable:**

- `expect(mock).not.toHaveBeenCalled()` - verifying a code path was NOT taken (no side effects occurred)
- When there's truly no observable state to check (rare with proper architecture)

**When there's no observable outcome:**
If you can't verify an outcome but the test exercises the code path, it's still valuable as a "doesn't crash" test. Just running the code and completing without error provides some confidence.

**Preferred alternatives:**

- Check store state after actions
- Check database state after operations
- Check return values
- Use real implementations with mocked system boundaries

### Don't Bypass Services to Manipulate State

**Never directly manipulate store state in tests.** Instead, use the actual service APIs to set up the state you need.

This is a corollary to Detroit-style testing: if you're directly calling `useStore.setState()` in your test setup, you're bypassing the real code paths that would normally set that state. This:

- Tests against an unrealistic state that may not be achievable through real code
- Misses bugs in the service layer that creates that state
- Creates brittle tests coupled to store implementation details

**Bad** - Directly manipulating state:

```typescript
// Bypasses the real play logic entirely
useTrackPlayer.setState({
  isPlaying: { playing: true, bufferingDuringPlay: false },
  lastPlayPause: { type: PlayPauseType.PLAY, source: PlayPauseSource.USER, ... },
});
```

**Good** - Using the service API:

```typescript
// Goes through the real play flow
await trackPlayerService.play(PlayPauseSource.USER);
```

**Setting up playthroughs for tests:**

**Bad** - Directly setting playthrough state:

```typescript
useTrackPlayer.setState({
  playthrough: { id: "fake-id", mediaId: "fake-media", ... } as any,
  progress: { position: 100, duration: 300, ... },
});
```

**Good** - Creating real data and loading through services:

```typescript
const db = getDb();
const book = await createBook(db, { title: "Test Book" });
const media = await createMedia(db, { bookId: book.id, duration: "300.0" });
const playthrough = await createPlaythrough(db, { mediaId: media.id });

await trackPlayerService.loadPlaythroughIntoPlayer(
  session,
  playthroughWithMedia,
);
```

**Exceptions:**

- Setting `initialized: true` to skip initialization logic when testing other concerns

### Service Reset Helpers for Testing

Services with module-level state (subscriptions, intervals, flags) provide `resetForTesting()` functions to clean up between tests. This prevents subscription accumulation and state pollution.

**Available reset helpers:**

- `track-player-service.ts` → `resetForTesting()`: Clears intervals, resets `awaitingIsPlayingMatch`, unsubscribes all, resets store
- `sleep-timer-service.ts` → `resetForTesting()`: Clears timer interval, unsubscribes all, resets store

**Usage pattern:**

```typescript
import { resetForTesting as resetTrackPlayerService } from "@/services/track-player-service";
import { resetForTesting as resetSleepTimerService } from "@/services/sleep-timer-service";

describe("my-service", () => {
  beforeEach(async () => {
    await trackPlayerService.initialize();
  });

  afterEach(() => {
    resetTrackPlayerService();
    resetSleepTimerService();
  });
});
```

**Why this matters:** Services set up subscriptions during `initialize()`. Without cleanup, each test adds more subscriptions, causing handlers to fire multiple times. This leads to flaky tests and incorrect behavior.

### Use Real Query Functions, Not Manual Data Construction

**Never manually construct complex data shapes in tests.** Use the real query functions that produce them.

When you manually construct objects to match a type (like `PlaythroughWithMedia`), you're:

- Encoding implementation details about the data shape in your tests
- Creating fragile tests that break when the shape changes
- Potentially constructing invalid states that the real code wouldn't produce

**Bad** - Manually constructing a complex type:

```typescript
// Manually building PlaythroughWithMedia shape - fragile!
const playthroughWithMedia = {
  ...playthrough,
  stateCache: stateCache ?? null,
  media: {
    id: media.id,
    thumbnails: media.thumbnails,
    // ... 20 more fields manually mapped
    book: {
      // ... more nested structure
    },
  },
};
await trackPlayerService.loadPlaythroughIntoPlayer(
  session,
  playthroughWithMedia as any,
);
```

**Good** - Using the real query function:

```typescript
// Create the data, then use the real query to get the proper shape
const playthrough = await createPlaythrough(db, {
  mediaId: media.id,
  position: 100,
});
const playthroughWithMedia = await getPlaythroughWithMedia(
  session,
  playthrough.id,
);
await trackPlayerService.loadPlaythroughIntoPlayer(
  session,
  playthroughWithMedia,
);
```

**Factories should hide implementation details:**

The `createPlaythrough` factory accepts `position`, `rate`, and `lastEventAt` parameters and internally creates the `playthroughStateCache` if needed. Callers don't need to know about the cache table:

```typescript
// Factory hides the cache implementation detail
const playthrough = await createPlaythrough(db, {
  mediaId: media.id,
  position: 100,
  rate: 1.5,
  lastEventAt: new Date("2024-01-15"),
});
```

### Running Tests

```bash
npm test               # Single run
npm run test:watch     # Watch mode (interactive development)
npm run test:coverage  # Single run with coverage report
```

Coverage reports are generated in `coverage/lcov-report/index.html`.

### Test File Conventions

- Place tests in `__tests__/` directories adjacent to source files
- Name test files `*.test.ts` or `*.test.tsx`
- Jest auto-discovers all matching files

### Database Testing Architecture

**Philosophy**: Use a real in-memory SQLite database (better-sqlite3) instead of mocking database calls. This tests actual SQL queries and Drizzle ORM behavior.

**Key Components**:

- `test/jest-setup.ts`: Global mock for `getDb()` that returns the test database
- `test/db-test-utils.ts`: `setupTestDatabase()` helper that creates fresh databases per test
- `test/factories.ts`: Factory functions to create test data with sensible defaults

**How It Works**:

1. `jest-setup.ts` mocks `@/src/db/db` globally with a `getDb()` that returns the test database
2. Each test file calls `setupTestDatabase()` which creates a fresh in-memory database before each test
3. Production code calls `getDb()` internally - no dependency injection needed
4. Factory functions receive the test `db` directly to set up test data

**Example Test**:

```typescript
import { getAllDownloads, createDownload } from "@/src/db/downloads";
import { setupTestDatabase } from "@test/db-test-utils";
import { createMedia, DEFAULT_TEST_SESSION } from "@test/factories";

const { getDb } = setupTestDatabase();

describe("downloads", () => {
  it("returns all downloads for the session", async () => {
    const db = getDb(); // Get test db for factories
    const media = await createMedia(db);

    await createDownload(session, media.id, "/path/to/file.mp4"); // Module uses getDb() internally

    const downloads = await getAllDownloads(session); // Module uses getDb() internally
    expect(downloads).toHaveLength(1);
  });
});
```

**Important**:

- Factory functions (`createMedia`, `createPlaythrough`, etc.) take `db` as first parameter
- Module functions (`getAllDownloads`, `createDownload`, etc.) do NOT take `db` - they call `getDb()` internally
- The global mock in `jest-setup.ts` ensures `getDb()` returns the test database

### Testing Zustand Stores

Stores export their own `resetForTesting()` function to reset state between tests:

```typescript
import { resetForTesting, useMyStore } from "@/stores/my-store";

describe("my store", () => {
  beforeEach(() => {
    resetForTesting();
  });

  it("does something", () => {
    // Store starts fresh with initial state
  });
});
```

Services that "own" a store (e.g., `track-player-service` owns `track-player` store) export their own `resetForTesting()` that cleans up service state AND calls the store's reset:

```typescript
import { resetForTesting as resetTrackPlayerService } from "@/services/track-player-service";

describe("track-player-service", () => {
  beforeEach(() => {
    resetTrackPlayerService(); // Resets service state + store state
  });
});
```

## Debugging

- Logs use `react-native-logs` with color-coded module prefixes (see Logging section)
- Expo DevTools: Network inspector, logs
- Drizzle Studio: Database inspection (dev only)
- React DevTools: Component inspection

## Git Workflow

Main branch: `main`

When creating commits or PRs, follow the existing commit message style in the git log.
