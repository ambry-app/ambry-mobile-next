import {
  PAUSE_REWIND_SECONDS,
  PLAYER_EXPAND_ANIMATION_DURATION,
} from "@/constants";
import {
  deletePlaythrough as deletePlaythroughDb,
  getInProgressPlaythroughWithMedia,
} from "@/db/playthroughs";
import { bumpPlaythroughDataVersion } from "@/stores/data-version";
import {
  requestExpandPlayer,
  resetPlayerUIState,
  setLoadingNewMedia,
  usePlayerUIState,
} from "@/stores/player-ui-state";
import { useSession } from "@/stores/session";
import { PlayPauseSource } from "@/stores/track-player";
import { Session } from "@/types/session";
import { subscribeToChange } from "@/utils/subscribe";

import * as Lifecycle from "./playthrough-lifecycle";
import * as Loader from "./playthrough-loader";
import * as Heartbeat from "./position-heartbeat";
import * as Player from "./track-player-service";

export type PlaythroughAction =
  | { type: "unloadPlayer" }
  | { type: "continueExistingPlaythrough"; playthroughId: string }
  | { type: "startFreshPlaythrough"; mediaId: string }
  | { type: "resumeAndLoadPlaythrough"; playthroughId: string }
  | { type: "promptForResume"; playthroughId: string };

// =============================================================================
// Internal Playback Helpers
// =============================================================================

async function play() {
  await Player.play(PlayPauseSource.USER);
}

async function pause() {
  await Player.pause(PlayPauseSource.USER, PAUSE_REWIND_SECONDS);
}

async function pauseIfPlaying() {
  const { playing } = Player.isPlaying();
  if (playing) {
    await pause();
  }
}

// =============================================================================
// Player Initialization & Media Loading
// =============================================================================

/**
 * Setup TrackPlayer and load the most recent media if not already initialized.
 * This is the coordinating function for player initialization.
 */
export async function initializePlayer(session: Session) {
  if (usePlayerUIState.getState().initialized) {
    console.debug("[Controls] Player already initialized, skipping");
    return;
  }

  console.debug("[Controls] Initializing player");

  usePlayerUIState.setState({ initialized: true });

  // Try to load the stored active playthrough if no track was pre-loaded
  await Loader.loadActivePlaythroughIntoPlayer(session);
}

/**
 * Load media and start playing with full state management.
 * Handles setting loading state, expanding player, querying playthrough state,
 * and calling appropriate loader function.
 */
export async function loadAndPlayMedia(session: Session, mediaId: string) {
  console.debug("[Controls] Loading and playing media:", mediaId);

  setLoadingNewMedia(true);
  await expandPlayerAndWait();

  const inProgress = await getInProgressPlaythroughWithMedia(session, mediaId);

  if (inProgress) {
    await Loader.continuePlaythrough(session, inProgress.id);
  } else {
    await Loader.startNewPlaythrough(session, mediaId);
  }

  setLoadingNewMedia(false);
  bumpPlaythroughDataVersion();
  await play();
}

/**
 * Continue an existing in-progress playthrough.
 */
export async function continueExistingPlaythrough(
  session: Session,
  playthroughId: string,
) {
  console.debug("[Controls] Continuing existing playthrough:", playthroughId);

  setLoadingNewMedia(true);
  await expandPlayerAndWait();

  await Loader.continuePlaythrough(session, playthroughId);
  setLoadingNewMedia(false);
  bumpPlaythroughDataVersion();
  await play();
}

/**
 * Start a fresh playthrough for media with no existing playthrough.
 */
export async function startFreshPlaythrough(session: Session, mediaId: string) {
  console.debug("[Controls] Starting fresh playthrough for media:", mediaId);

  setLoadingNewMedia(true);
  await expandPlayerAndWait();

  await Loader.startNewPlaythrough(session, mediaId);
  setLoadingNewMedia(false);
  bumpPlaythroughDataVersion();
  await play();
}

/**
 * Reload the currently loaded playthrough if it matches the given mediaId.
 *
 * This is used when switching between streaming and downloaded audio.
 * The reload is "smooth" - no pause/play events are recorded and no seek-back
 * happens. The player just switches to the new source at the same position.
 */
export async function reloadCurrentPlaythroughIfMedia(
  session: Session,
  mediaId: string,
): Promise<void> {
  const loadedPlaythrough = Player.getLoadedPlaythrough();

  if (!loadedPlaythrough || loadedPlaythrough.mediaId !== mediaId) {
    return;
  }

  const { playing } = Player.isPlaying();

  console.debug(
    "[Controls] Reloading current playthrough for media:",
    mediaId,
    "playthroughId:",
    loadedPlaythrough.id,
    "wasPlaying:",
    playing,
  );

  if (playing) {
    await Player.pause(PlayPauseSource.INTERNAL);
  }

  await Heartbeat.saveNow();
  await Loader.reloadPlaythroughById(session, loadedPlaythrough.id);

  if (playing) {
    await Player.play(PlayPauseSource.INTERNAL);
  }
}

/**
 * Resume a specific playthrough and load it into the player.
 */
export async function resumeAndLoadPlaythrough(
  session: Session,
  playthroughId: string,
) {
  console.debug("[Controls] Resuming playthrough:", playthroughId);

  setLoadingNewMedia(true);
  await expandPlayerAndWait();

  await Loader.resumePlaythrough(session, playthroughId);

  setLoadingNewMedia(false);
  bumpPlaythroughDataVersion();

  await play();
}

export async function applyPlaythroughAction(
  session: Session,
  action: PlaythroughAction,
) {
  switch (action.type) {
    case "unloadPlayer":
      await unloadPlayer(session);
      break;
    case "continueExistingPlaythrough":
      await continueExistingPlaythrough(session, action.playthroughId);
      break;
    case "startFreshPlaythrough":
      await startFreshPlaythrough(session, action.mediaId);
      break;
    case "resumeAndLoadPlaythrough":
      await resumeAndLoadPlaythrough(session, action.playthroughId);
      break;
    case "promptForResume":
      // No-op: handled by UI
      break;
  }
}

// =============================================================================
// Player State Management (Unload, Finish, Abandon)
// =============================================================================

/**
 * Mark a playthrough as finished and unload it from the player if loaded.
 */
export async function finishPlaythrough(
  session: Session,
  playthroughId: string,
  options?: { skipUnload?: boolean },
) {
  const loadedPlaythrough = Player.getLoadedPlaythrough();
  const isLoaded = loadedPlaythrough?.id === playthroughId;

  if (isLoaded) {
    await pauseIfPlaying();
  }

  await Lifecycle.finishPlaythrough(session, playthroughId);

  if (isLoaded && !options?.skipUnload) {
    await tryUnloadPlayer();
  }
}

/**
 * Mark a playthrough as abandoned and unload it from the player if loaded.
 */
export async function abandonPlaythrough(
  session: Session,
  playthroughId: string,
) {
  const loadedPlaythrough = Player.getLoadedPlaythrough();
  const isLoaded = loadedPlaythrough?.id === playthroughId;

  if (isLoaded) {
    await pauseIfPlaying();
  }

  await Lifecycle.abandonPlaythrough(session, playthroughId);

  if (isLoaded) {
    await tryUnloadPlayer();
  }
}

/**
 * Delete a playthrough and unload it from the player if loaded.
 */
export async function deletePlaythrough(
  session: Session,
  playthroughId: string,
) {
  const loadedPlaythrough = Player.getLoadedPlaythrough();
  const isLoaded = loadedPlaythrough?.id === playthroughId;

  if (isLoaded) {
    await pauseIfPlaying();
    await tryUnloadPlayer();
  }

  await deletePlaythroughDb(session, playthroughId);
  bumpPlaythroughDataVersion();
}

/**
 * Unload the player and clear the active playthrough.
 */
export async function unloadPlayer(session: Session) {
  await Loader.clearActivePlaythrough(session);
  await tryUnloadPlayer();
}

/**
 * Attempts to unload the TrackPlayer and reset UI state.
 * Handles clearing timers and pausing playback.
 */
export async function tryUnloadPlayer() {
  // There were seek timers here, but they are now managed by seek-service.ts
  // We just need to ensure playback is paused and player is reset.
  await pauseIfPlaying();
  await Player.unload();
  resetPlayerUIState();
}

/**
 * Forcefully unloads the player without pausing.
 * Used for session cleanup during sign-out.
 */
export async function forceUnloadPlayer() {
  // There were seek timers here, but they are now managed by seek-service.ts
  await Player.unload();
  resetPlayerUIState();
}

// =============================================================================
// Player UI Expansion
// =============================================================================

/**
 * Requests the UI to expand the player.
 */
export function expandPlayer() {
  requestExpandPlayer();
}

/**
 * Expands the player UI and waits for the animation to complete.
 */
export function expandPlayerAndWait(): Promise<void> {
  requestExpandPlayer();
  return new Promise((resolve) => {
    setTimeout(resolve, PLAYER_EXPAND_ANIMATION_DURATION);
  });
}

// =============================================================================
// Reactive Session Cleanup
// =============================================================================

// Subscribe to session changes - when signed out, clean up the player
subscribeToChange(
  useSession,
  (s) => s.session,
  (session, prevSession) => {
    if (prevSession && !session) {
      console.debug("[Controls] Session signed out, cleaning up player");
      forceUnloadPlayer().catch((error) => {
        console.warn("[Controls] Error during session cleanup:", error);
      });
    }
  },
);
