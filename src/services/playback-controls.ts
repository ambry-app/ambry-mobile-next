import {
  PAUSE_REWIND_SECONDS,
  PLAYER_EXPAND_ANIMATION_DURATION,
} from "@/constants";
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

import * as Operations from "./playthrough-operations";
import * as Heartbeat from "./position-heartbeat";
import * as Player from "./track-player-service";

export type PlaythroughAction =
  | { type: "unloadPlaythrough" }
  | { type: "continueExistingPlaythrough"; playthroughId: string }
  | { type: "startFreshPlaythrough"; mediaId: string }
  | { type: "resumeAndLoadPlaythrough"; playthroughId: string }
  | { type: "promptForResume"; playthroughId: string };

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
  await Operations.loadActivePlaythroughIntoPlayer(session);
}

/**
 * Continue an existing in-progress playthrough.
 */
export async function continueExistingPlaythrough(
  session: Session,
  playthroughId: string,
) {
  console.debug("[Controls] Continuing existing playthrough:", playthroughId);

  await pauseIfPlaying();
  setLoadingNewMedia(true);
  await expandPlayerAndWait();

  await Operations.continuePlaythrough(session, playthroughId);
  setLoadingNewMedia(false);
  bumpPlaythroughDataVersion();
  await play();
}

/**
 * Start a fresh playthrough for media with no existing playthrough.
 */
export async function startFreshPlaythrough(session: Session, mediaId: string) {
  console.debug("[Controls] Starting fresh playthrough for media:", mediaId);

  await pauseIfPlaying();
  setLoadingNewMedia(true);
  await expandPlayerAndWait();

  await Operations.startNewPlaythrough(session, mediaId);
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
  await Operations.reloadPlaythroughById(session, loadedPlaythrough.id);

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

  await pauseIfPlaying();
  setLoadingNewMedia(true);
  await expandPlayerAndWait();

  await Operations.resumePlaythrough(session, playthroughId);

  setLoadingNewMedia(false);
  bumpPlaythroughDataVersion();

  await play();
}

export async function applyPlaythroughAction(
  session: Session,
  action: PlaythroughAction,
) {
  switch (action.type) {
    case "unloadPlaythrough":
      await unloadPlaythrough(session);
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
    default:
      const _exhaustive: never = action;
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

  await Operations.finishPlaythrough(session, playthroughId);

  if (isLoaded && !options?.skipUnload) {
    await unload();
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

  await Operations.abandonPlaythrough(session, playthroughId);

  if (isLoaded) {
    await unload();
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
  }

  await Operations.deletePlaythrough(session, playthroughId);

  if (isLoaded) {
    await unload();
  }
}

/**
 * Unload the player and clear the active playthrough.
 */
export async function unloadPlaythrough(session: Session) {
  await pauseIfPlaying();
  await Operations.clearActivePlaythrough(session);
  await unload();
}

/**
 * Unload the player, but keep the active playthrough.
 */
export async function unloadPlayer() {
  await pauseIfPlaying();
  await unload();
}

/**
 * Forcefully unloads the player without pausing.
 */
export async function forceUnloadPlayer() {
  await unload();
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
// Internal Playback Helpers
// =============================================================================

async function play() {
  await Player.play(PlayPauseSource.USER);
}

async function pauseIfPlaying() {
  await Player.pauseIfPlaying(PlayPauseSource.USER, PAUSE_REWIND_SECONDS);
}

async function unload() {
  await Player.unload();
  resetPlayerUIState();
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
