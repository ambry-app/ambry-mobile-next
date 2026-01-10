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
import { Session } from "@/types/session";

import * as EventRecording from "./event-recording";
import * as Lifecycle from "./playthrough-lifecycle";
import * as Loader from "./playthrough-loader";
import * as Heartbeat from "./position-heartbeat";
import { seekImmediateNoLog } from "./seek-service";
import * as SleepTimer from "./sleep-timer-service";
import { syncPlaythroughs } from "./sync-service";
import * as Player from "./track-player-service";

export type PlaythroughAction =
  | { type: "unloadPlayer" }
  | { type: "continueExistingPlaythrough"; playthroughId: string }
  | { type: "startFreshPlaythrough"; mediaId: string }
  | { type: "resumeAndLoadPlaythrough"; playthroughId: string }
  | { type: "promptForResume"; playthroughId: string };

// =============================================================================
// Public Playback Actions (Play, Pause, Rate)
// =============================================================================

/**
 * Start or resume playback.
 */
export async function play() {
  const { position } = await Player.getAccurateProgress();
  console.debug("[Controls] Playing from position", position.toFixed(1));
  await Player.play();

  const loadedPlaythrough = Player.getLoadedPlaythrough();
  if (loadedPlaythrough) {
    try {
      const { position } = await Player.getAccurateProgress();
      const rate = Player.getPlaybackRate();

      await EventRecording.recordPlayEvent(
        loadedPlaythrough.id,
        position,
        rate,
      );
      Heartbeat.start(loadedPlaythrough.id, rate);
    } catch (error) {
      console.warn("[Controls] Error recording play event:", error);
    }
  }
  await SleepTimer.start();
}

/**
 * Pause playback.
 * Rewinds slightly for context.
 */
export async function pause() {
  const { position } = await Player.getAccurateProgress();
  console.debug("[Controls] Pausing at position", position.toFixed(1));
  await Player.pause();
  await seekImmediateNoLog(-PAUSE_REWIND_SECONDS);

  Heartbeat.stop();

  const loadedPlaythrough = Player.getLoadedPlaythrough();
  const playbackRate = Player.getPlaybackRate();

  if (loadedPlaythrough) {
    try {
      const { position } = await Player.getAccurateProgress();
      await EventRecording.recordPauseEvent(
        loadedPlaythrough.id,
        position,
        playbackRate,
      );
    } catch (error) {
      console.warn("[Controls] Error recording pause event:", error);
    }
  }

  await SleepTimer.stop();

  const session = useSession.getState().session;
  if (session) {
    syncPlaythroughs(session);
  }
}

/**
 * Pause playback only if it is currently playing.
 * Useful for pre-loading actions to avoid firing unnecessary pause events.
 */
export async function pauseIfPlaying() {
  const { playing } = Player.isPlaying();
  if (playing) {
    await pause();
  }
}

/**
 * Set the playback rate.
 */
export async function setPlaybackRate(playbackRate: number) {
  const previousRate = Player.getPlaybackRate();

  await Player.setPlaybackRate(playbackRate);

  const loadedPlaythrough = Player.getLoadedPlaythrough();
  if (loadedPlaythrough) {
    try {
      const { position } = await Player.getAccurateProgress();
      await EventRecording.recordRateChangeEvent(
        loadedPlaythrough.id,
        position,
        playbackRate,
        previousRate,
      );
      Heartbeat.setPlaybackRate(playbackRate);
    } catch (error) {
      console.warn("[Controls] Error recording rate change:", error);
    }
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
  setLoadingNewMedia(false);
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
 */
export async function reloadCurrentPlaythroughIfMedia(
  session: Session,
  mediaId: string,
): Promise<void> {
  const loadedPlaythrough = Player.getLoadedPlaythrough();

  if (!loadedPlaythrough || loadedPlaythrough.mediaId !== mediaId) {
    return;
  }

  console.debug(
    "[Controls] Reloading current playthrough for media:",
    mediaId,
    "playthroughId:",
    loadedPlaythrough.id,
  );

  await pauseIfPlaying();
  await Heartbeat.saveNow();

  await Loader.reloadPlaythroughById(session, loadedPlaythrough.id);
  setLoadingNewMedia(false);
  await play();
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
    const paused = await pauseAndRecordEvent();
    if (paused) {
      Heartbeat.stop();
    }
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
    const paused = await pauseAndRecordEvent();
    if (paused) {
      Heartbeat.stop();
    }
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
    const paused = await pauseAndRecordEvent();
    if (paused) {
      Heartbeat.stop();
    }
    await tryUnloadPlayer();
  }

  await deletePlaythroughDb(session, playthroughId);
  bumpPlaythroughDataVersion();
}

/**
 * Pause playback (if playing) and record the pause event, waiting for it to complete.
 * Use this when you need to ensure the pause event is recorded before
 * performing other operations (like marking a playthrough as finished/abandoned).
 *
 * Only records a pause event if audio is actually playing. If already paused,
 * this is a no-op (the pause event was already recorded when playback stopped).
 *
 * Returns true if a pause was recorded, false if already paused.
 */
async function pauseAndRecordEvent(): Promise<boolean> {
  const loadedPlaythrough = Player.getLoadedPlaythrough();
  const playbackRate = Player.getPlaybackRate();

  if (!loadedPlaythrough) return false;

  const { playing } = Player.isPlaying();
  if (!playing) {
    console.debug("[Controls] pauseAndRecordEvent: not playing, skipping");
    return false;
  }

  await Player.pause();
  const { position } = await Player.getAccurateProgress();
  await EventRecording.recordPauseEvent(
    loadedPlaythrough.id,
    position,
    playbackRate,
  );
  console.debug("[Controls] pauseAndRecordEvent completed");
  return true;
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
useSession.subscribe((state, prevState) => {
  if (prevState.session && !state.session) {
    console.debug("[Controls] Session signed out, cleaning up player");
    forceUnloadPlayer().catch((error) => {
      console.warn("[Controls] Error during session cleanup:", error);
    });
  }
});
