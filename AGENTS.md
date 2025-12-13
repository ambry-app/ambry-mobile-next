# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ambry is a React Native/Expo mobile app (iOS & Android) for streaming and downloading audiobooks from a self-hosted server. The app provides offline playback, library browsing, and syncs playback progress across devices.

## Development Commands

### Running the App

```bash
npm start                    # Start Expo dev server
npm run ios                  # Run on iOS simulator
npm run android              # Run on Android emulator/device
npm run prebuild             # Generate native code (when needed)
```

### Code Generation & Database

```bash
npm run codegen              # Generate GraphQL types from server schema
npm run codegen-watch        # Watch mode for GraphQL codegen
npm run generate-migrations  # Generate Drizzle ORM migrations after schema changes
```

### Quality & Diagnostics

```bash
npm run lint                 # Run ESLint (includes Prettier formatting checks)
npm run lint -- --fix        # Auto-fix ESLint and formatting issues
npx tsc                      # Type check (run after changes)
npm test                     # Run Jest tests once (for CI/scripts)
npm run test:watch           # Run Jest tests in watch mode
npm run test:coverage        # Run Jest tests with coverage reporting
npm run doctor               # Check Expo environment health
```

**Important**: After making code changes, always run `npx tsc` to check for type errors and `npm run lint` to verify linting and formatting. Use `npm run lint -- --fix` to auto-fix issues before committing.

### Building

```bash
npm run android-preview      # Build Android preview locally with EAS
npm run ios-preview          # Build iOS preview locally with EAS
```

## Architecture Overview

### Technology Stack

- **React Native 0.81.5** with **Expo ~54.0.25**
- **Expo Router 6.0.15**: File-based routing
- **Zustand 5.0.5**: Global state management
- **Drizzle ORM 0.44.2** with **Expo SQLite**: Local database
- **react-native-track-player 5.0.0-alpha0**: Background audio playback
- **GraphQL**: Custom client with code generation for type safety

### Core Directories

- **`/src/app/`**: Expo Router file-based routing. Each file is a route, `_layout.tsx` files define navigation structure
- **`/src/components/`**: Reusable UI components. Complex screens in `screens/` subdirectory with modular organization
- **`/src/stores/`**: Zustand stores for global state (session, player, downloads, data-version, screen)
- **`/src/db/`**: Drizzle ORM schema, migrations, and data access layer
  - `schema.ts`: Complete database schema
  - `sync.ts`: Bi-directional server sync logic
  - `library/`: Query functions organized by entity type
- **`/src/graphql/`**: GraphQL API layer
  - `api.ts`: High-level API functions
  - `client/`: Generated types and execution logic
- **`/src/services/`**: Background services (playback service, background sync)
- **`/src/hooks/`**: Custom React hooks for common patterns
- **`/src/utils/`**: Utility functions (event-bus, time formatting, paths)
- **`/src/styles/`**: Design system colors and style utilities

### State Management Pattern

**Zustand Stores** (not Redux, not Context):

- **`device.ts`**: Device info (id, type, brand, model, OS) - ID persisted to SecureStore
- **`session.ts`**: Authentication state (email, token, server URL) - persisted to SecureStore
- **`data-version.ts`**: Library data versioning and sync timestamps
- **`downloads.ts`**: Download management and progress tracking
- **`sleep-timer.ts`**: Sleep timer state (duration, enabled, trigger time)
- **`player.ts`**: Audio player state (position, duration, rate, seeking state, chapters)
- **`screen.ts`**: UI state (dimensions, keyboard visibility)

**Store Initialization Pattern:**
All stores (except session and screen) follow a consistent initialization pattern:

- Each has an `initialized: boolean` flag
- Each exports an `initialize*()` async function
- Initialize functions check the flag and skip if already initialized
- This enables efficient app resume when JS context persists (see JS Context Architecture)

```typescript
// Example: initializeDownloads in downloads.ts
export async function initializeDownloads(session: Session) {
  if (useDownloads.getState().initialized) {
    console.debug("[Downloads] Already initialized, skipping");
    return;
  }
  // ... load from DB
  useDownloads.setState({ initialized: true, downloads });
}
```

**Access pattern:** Import and use directly

```typescript
import { useSession } from "@/stores/session";

const { email, token } = useSession();
const logout = useSession((state) => state.logout);
```

### Audio Playback Architecture

**Background Audio Service**:

- Uses `react-native-track-player` (alpha version)
- Service registered in `entry.js` before app renders
- Runs as Android foreground service with persistent notification
- Service code: `src/services/playback-service.ts`
- Acts as thin adapter: translates TrackPlayer events → EventBus events
- Remote control events (lock screen, headphones) handled via EventBus

**Background Services Architecture**:
Services are decoupled via EventBus:

- **`playback-service.ts`**: TrackPlayer event adapter, emits EventBus events
- **`event-recording-service.ts`**: Records playback events (play, pause, seek, rate change) for sync
- **`sleep-timer-service.ts`**: Manages sleep timer, volume fade, auto-pause
- **`progress-save-service.ts`**: Periodically saves playback position to DB (30s interval while playing)

Each service:

- Initializes via `startMonitoring()` called from playback service
- Sets up its own EventBus listeners
- Self-contained with no direct dependencies on other services

**JS Context Architecture** (tested and confirmed):

- TrackPlayer's foreground service keeps the **same JS context alive** even when app is swiped away
- All modules (player store, services, EventBus) share the same runtime instance
- Module-level variables, timers, and EventBus listeners persist across app "kills"
- Force-stopping via Android Settings kills the foreground service entirely (no remote playback possible)
- There is effectively **no dual-context scenario** in practice - the only way to trigger playback is to launch the app, which shares the existing context

**Important**: Because the JS context persists, Zustand stores and module-level variables survive app "kills". If state appears to be lost, the likely cause is the **app boot sequence resetting it**, not context separation. The sleep timer is a good example: `sleepTimerTriggerTime` lives only in Zustand (not DB) and survives app kills because we don't reset it on boot. User preferences (duration, enabled) are persisted to DB, but transient runtime state (trigger time) stays in memory.

**Player State** (`stores/player.ts`):

- Complex seeking logic with accumulation (prevents stuttering from rapid taps)
- Dual position tracking: server-synced vs local modifications
- Chapter navigation with automatic current chapter detection
- Supports both streaming (HLS/DASH) and downloaded (MP4) playback

**Critical**: When modifying player logic, understand the seek accumulation pattern:

- Multiple rapid seeks accumulate before applying (500ms window)
- Prevents jitter and excessive native calls
- See `utils/seek.ts` and `stores/player.ts` for implementation

### Database Architecture

**SQLite with Drizzle ORM**:

- Write-Ahead Logging (WAL) mode enabled for performance
- Multi-tenant design: Every table includes `url` (server URL) in composite keys
- Supports multiple server connections in one database

**Key Tables**:

- **Library tables**: `people`, `authors`, `narrators`, `books`, `media`, `series` (synced from server)
- **Player state**: `playerStates` (server source), `localPlayerStates` (local modifications)
- **Downloads**: `downloads` (local file paths, resumable state)
- **User data**: `localUserSettings`, `shelvedMedia`
- **Sync metadata**: `syncedServers`, `serverProfiles` (timestamps for incremental sync)

**Dual-state Pattern for Player Progress**:

- `playerStates`: Read-only, synced from server
- `localPlayerStates`: Local modifications pending sync
- When loading media, compare timestamps to use newer state
- Progress automatically saved every 30s during playback (via `progress-save-service.ts`)
- Saved immediately on pause and playback end
- See `db/player-states.ts` for reconciliation logic

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

**Bi-directional Sync** (`db/sync.ts`):

**Down-sync** (pull from server):

1. Query `getLibraryChangesSince(lastDownSync)` - single large query
2. Transform GraphQL data to database schema
3. Upsert all records in single transaction
4. Handle deletions
5. Update `lastDownSync` and `newDataAsOf` timestamps

**Up-sync** (push to server):

1. Query local player state changes since `lastUpSync`
2. Send each changed state via `updatePlayerState` mutation
3. Update `lastUpSync` timestamp

**Sync Timing**:

- Initial sync on first login (blocks app)
- Foreground sync: Every 15 minutes (see `hooks/use-foreground-sync.ts`)
- Background sync: Every 15 minutes minimum (see `services/background-sync-service.ts`)
- Manual sync: Pull-to-refresh on library screens

**Cache Invalidation**:

- Global `libraryDataVersion` store tracks last sync
- UI components use `useLibraryData()` hook which auto-refetches on version change
- After sync completes: `setLibraryDataVersion(new Date())`

### Navigation & Routing

**File-based with Expo Router**:

- `app/_layout.tsx`: Root layout with auth guards
- `app/(tabs)/`: Protected tab navigation
  - `(library)/`: Library stack (search, book/media/author/series details)
  - `(shelf)/`: User shelf stack (now playing, in-progress)
  - `downloads.tsx`, `settings.tsx`: Tab screens
- Modal screens: `sleep-timer.tsx`, `playback-rate.tsx`, `chapter-select.tsx`

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

**Boot Sequence** (`hooks/use-app-boot.ts`):

1. Apply database migrations (Drizzle `useMigrations` hook)
2. Check session (exit early if none)
3. `initializeDevice()` - Load/create device ID from SecureStore
4. `initializeDataVersion(session)` - Load sync timestamps, returns `{ needsInitialSync }`
5. `initializeDownloads(session)` - Load download states from DB
6. `initializeSleepTimer(session)` - Load sleep timer preferences from DB
7. Initial sync if needed (`syncDown` on first connection to server)
8. `initializePlayer(session)` - Setup TrackPlayer + load most recent media
9. Register background sync task
10. Set ready (hide splash screen)

**Key behavior**: Each `initialize*()` function checks its store's `initialized` flag and skips if already initialized. This enables efficient app resume when JS context persists - stores already have correct state from before app was "killed", so no redundant DB queries occur.

**Critical**: Modifications to boot flow must maintain order - some steps depend on previous steps (e.g., sync needs data version, player may need device info).

## Important Patterns & Conventions

### Result Pattern for Error Handling

Instead of throwing exceptions, functions return `Result<T, E>` discriminated unions:

```typescript
type Result<T, E> = { success: true; result: T } | { success: false; error: E };
```

This forces exhaustive error handling at call sites.

### Event Bus for Cross-Component Communication

Simple EventEmitter pattern (`utils/event-bus.ts`):

- Decouples background services from UI components
- Key events: `playbackStarted`, `playbackPaused`, `seekApplied`, `playbackQueueEnded`, `remoteDuck`, `expandPlayer`, `playbackRateChanged`
- Background services listen to events and handle their own concerns
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

- `SEEK_ACCUMULATION_WINDOW`: Debounce window for rapid seeks (500ms)
- `SEEK_EVENT_ACCUMULATION_WINDOW`: Delay before logging seek events (5s)
- `PROGRESS_SAVE_INTERVAL`: How often to save position during playback (30s)
- `SLEEP_TIMER_FADE_OUT_TIME`: Duration of volume fade before sleep timer triggers (30s)

Keep all timing/interval constants here for easy adjustment.

## Testing

**Framework**: Jest with `jest-expo` preset.

### Hook Testing Libraries: Current State and Guidance

**Important:** As of 2025, there are two main libraries for testing React hooks:

- **@testing-library/react-hooks** (deprecated, but stable)
- **@testing-library/react-native** (actively developed, new `renderHook` API)

#### Deprecation and Migration

- `@testing-library/react-hooks` is deprecated, but still recommended for complex hooks (timers, debounce, async) in React Native, due to better support for Jest fake timers and React Native quirks.
- The new `renderHook` API in `@testing-library/react-native` is intended to replace it, but is not yet fully feature-complete or reliable for timer-based hooks as of late 2025.

#### Our Policy

- **Both libraries are installed.**
- Use `@testing-library/react-native`'s `renderHook` for simple hooks (no timers, no async effects).
- Use `@testing-library/react-hooks` for complex hooks (timers, debounce, async) until the new API is fully stable and reliable for React Native.
- Monitor [release notes](https://github.com/callstack/react-native-testing-library/releases) and issues for updates; migrate fully when the new API is ready.

#### References

- [Migration guide](https://react-hooks-testing-library.com/migration/react-18)
- [Open issues](https://github.com/callstack/react-native-testing-library/issues?q=renderHook) on timer/fake timer support
- [Discussions](https://github.com/testing-library/react-hooks-testing-library/issues) about limitations of the new API

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

### Running Tests

```bash
npm test            # Watch mode (interactive development)
npm run test:ci     # Single run (CI/scripts)
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

Use `test/store-test-utils.ts` to reset store state between tests:

```typescript
import { useMyStore } from "@/src/stores/my-store";
import { resetStoreBeforeEach } from "@test/store-test-utils";

const initialState = {
  /* ... */
};

describe("my store", () => {
  resetStoreBeforeEach(useMyStore, initialState);

  it("does something", () => {
    // Store is reset to initialState before each test
  });
});
```

### What to Test

- **Database modules**: Query logic, multi-tenant isolation, CRUD operations
- **GraphQL interactions**: API functions, sync logic, error handling (mock only `fetch`)
- **Pure functions**: Data transformation, formatting utilities, business logic helpers
- **Stores**: State transitions, initialization logic

## Debugging

- Console logs prefixed by component: `[Player]`, `[SyncDown]`, `[LoadMedia]`
- Expo DevTools: Network inspector, logs
- Drizzle Studio: Database inspection (dev only, enabled via `useDrizzleStudio()`)
- React DevTools: Component inspection

## Git Workflow

Main branch: `main`

When creating commits or PRs, follow the existing commit message style in the git log.
