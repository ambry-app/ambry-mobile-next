/**
 * Application Logger
 *
 * Uses react-native-logs with a custom transport that supports true color (24-bit)
 * and maps log levels to the correct console methods.
 *
 * ## Usage
 *
 * ```typescript
 * import { logBase } from "@/utils/logger";
 * const log = logBase.extend("my-module");
 *
 * log.info("User action happened");
 * log.debug("Implementation detail");
 * ```
 *
 * ## Log Level Guidelines
 *
 * | Level   | When to Use                                                 | Examples                                      |
 * |---------|-------------------------------------------------------------|-----------------------------------------------|
 * | error   | Unexpected failures, caught exceptions indicating bugs      | Failed to load media, sync failed             |
 * | warn    | Recoverable issues, degraded functionality                  | Retry needed, fallback used, missing data     |
 * | info    | Significant mutations/actions (DB writes, state changes)    | "Recorded play event", "Loading playthrough"  |
 * | debug   | Implementation details, skipped actions, downstream effects | "Skipping debounced event", state transitions |
 * | silly   | Very spammy, usually disabled during development            | Progress ticks, frequent polling results      |
 *
 * ## Extension Color Families
 *
 * Extensions are color-coded by functional area:
 *
 * - **Playback (Purple/Violet)**: Audio playback, player state, seeking
 * - **Playthrough (Pink/Rose)**: Progress tracking, event recording
 * - **Sync/Data (Blue/Cyan)**: API calls, data sync, database operations
 * - **Downloads (Orange)**: Download management
 * - **Boot/Auth (Green)**: App startup, authentication, session
 * - **Library/UI (Teal)**: Library browsing, shelves, UI state
 */

import { logger } from "react-native-logs";

import { type Color, coloredConsoleTransport } from "./transport";

// =============================================================================
// Extension Color Definitions (organized by functional family)
// =============================================================================

const extensionColors: Record<string, Color> = {
  // ---------------------------------------------------------------------------
  // Playback Family (Purple/Violet) - Audio playback, player state, seeking
  // ---------------------------------------------------------------------------
  "track-player-service": "#c678dd",
  "track-player-wrapper": "#b668cd",
  "playback-service": "#a658bd",
  "playback-controls": "#9648ad",
  "seek-service": "#c678dd",
  "chapter-service": "#b668cd",
  "sleep-timer": "#a658bd",
  "preferred-rate": "#9648ad",
  scrubber: "#9648ad",

  // ---------------------------------------------------------------------------
  // Playthrough Family (Pink/Rose) - Progress tracking, event recording
  // ---------------------------------------------------------------------------
  "playthrough-ops": "#e06c75",
  "playthrough-query": "#d55c65",
  "event-recording": "#ca4c55",
  "position-heartbeat": "#bf3c45",

  // ---------------------------------------------------------------------------
  // Sync/Data Family (Blue/Cyan) - API, sync, database operations
  // ---------------------------------------------------------------------------
  "sync-service": "#61afef",
  "background-sync": "#56a3df",
  graphql: "#4b97cf",
  "db-sync": "#61afef",
  "data-version": "#56a3df",
  db: "#4b97cf",

  // ---------------------------------------------------------------------------
  // Downloads Family (Orange) - Download management
  // ---------------------------------------------------------------------------
  "download-service": "#d19a66",
  "db-downloads": "#c18a56",

  // ---------------------------------------------------------------------------
  // Boot/Auth Family (Green) - App startup, authentication, session
  // ---------------------------------------------------------------------------
  "boot-service": "#98c379",
  "db-service": "#88b369",
  "auth-service": "#78a359",
  session: "#98c379",
  device: "#88b369",
  migration: "#78a359",

  // ---------------------------------------------------------------------------
  // Library/UI Family (Teal) - Library, shelves, hooks, stores, UI state
  // ---------------------------------------------------------------------------
  "library-service": "#56b6c2",
  "shelf-service": "#46a6b2",
  hooks: "#3696a2",
  "player-ui": "#56b6c2",
  "app-state": "#46a6b2",
};

// =============================================================================
// Logger Configuration
// =============================================================================

export const logBase = logger.createLogger({
  enabled: __DEV__,
  severity: "info",
  levels: {
    silly: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
  },
  transport: coloredConsoleTransport,
  transportOptions: {
    colors: {
      silly: "magentaBright",
      debug: "blueBright",
      warn: "yellowBright",
      error: "redBright",
    },
    extensionColors,
  },
  // Don't print level text (console methods already indicate level)
  printLevel: false,
  // Pad all extensions to same length for aligned output
  fixedExtLvlLength: true,
});
