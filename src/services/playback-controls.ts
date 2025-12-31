import {
  PAUSE_REWIND_SECONDS,
  PLAYER_EXPAND_ANIMATION_DURATION,
} from "@/constants";
import {
  getInProgressPlaythrough,
  getPlaythroughById,
} from "@/db/playthroughs";
import {
  initialChapterState,
  resetPlayerUIState,
  usePlayerUIState,
} from "@/stores/player-ui-state";
import { Session, useSession } from "@/stores/session";

import * as Coordinator from "./playback-coordinator";
import * as Lifecycle from "./playthrough-lifecycle";
import * as Loader from "./playthrough-loader";
import * as Heartbeat from "./position-heartbeat";
import { seekImmediateNoLog } from "./seek-service";
import * as Player from "./trackplayer-wrapper";
import {
  AndroidAudioContentType,
  Capability,
  IOSCategory,
  IOSCategoryMode,
} from "./trackplayer-wrapper";

// =============================================================================
// Public Playback Actions (Play, Pause, Rate)
// =============================================================================

/**
 * Start or resume playback.
 */
export async function play() {
  const { position } = await Player.getProgress();
  console.debug("[Controls] Playing from position", position.toFixed(1));
  await Player.play();
  Coordinator.onPlay();
}

/**
 * Pause playback.
 * Rewinds slightly for context.
 */
export async function pause() {
  const { position } = await Player.getProgress();
  console.debug("[Controls] Pausing at position", position.toFixed(1));
  await Player.pause();
  await seekImmediateNoLog(-PAUSE_REWIND_SECONDS);
  Coordinator.onPause();
}

/**
 * Pause playback only if it is currently playing.
 * Useful for pre-loading actions to avoid firing unnecessary pause events.
 */
export async function pauseIfPlaying() {
  const { playing } = await Player.isPlaying();
  if (playing) {
    await pause();
  }
}

/**
 * Set the playback rate.
 */
export async function setPlaybackRate(session: Session, playbackRate: number) {
  const previousRate = usePlayerUIState.getState().playbackRate;
  usePlayerUIState.setState({ playbackRate });

  await Player.setRate(playbackRate);

  // Notify coordinator for event recording
  const { position } = await Player.getProgress();
  Coordinator.onRateChanged({
    previousRate,
    newRate: playbackRate,
    position,
  });
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

  try {
    // Check if TrackPlayer already has a track loaded (e.g., from headless context)
    let trackLoadResult: Loader.TrackLoadResult | null = null;
    try {
      const track = await Player.getTrack(0);
      if (track) {
        const playthroughId = track.description!;
        const streaming = track.url.startsWith("http");
        const progress = await Player.getProgress();
        const playbackRate = await Player.getRate();

        const playthrough = await getPlaythroughById(session, playthroughId);

        if (!playthrough) {
          console.warn(
            "[Controls] Track loaded but playthrough not found:",
            playthroughId,
          );
          await Player.reset(); // Reset TrackPlayer since the loaded track is invalid
        } else {
          trackLoadResult = {
            playthroughId,
            mediaId: playthrough.media.id,
            position: progress.position,
            duration: progress.duration,
            playbackRate,
            streaming,
            chapters: playthrough.media.chapters,
          };
        }
      }
    } catch (e) {
      console.debug("[Controls] TrackPlayer not yet set up, proceeding:", e);
    }

    // Set up TrackPlayer if not already set up or reset
    await setupTrackPlayer();

    usePlayerUIState.setState({ initialized: true });

    if (trackLoadResult) {
      applyTrackLoadResult(trackLoadResult);
    } else {
      // Try to load the stored active playthrough if no track was pre-loaded
      const track = await Loader.loadActivePlaythroughIntoPlayer(session);
      if (track) {
        applyTrackLoadResult(track);
      }
    }
  } catch (error) {
    console.error("[Controls] Player initialization failed:", error);
  }
}

/**
 * Low-level TrackPlayer setup.
 * Configures TrackPlayer options (capabilities, notification, etc.).
 */
async function setupTrackPlayer() {
  await Player.setupPlayer({
    androidAudioContentType: AndroidAudioContentType.Speech,
    iosCategory: IOSCategory.Playback,
    iosCategoryMode: IOSCategoryMode.SpokenAudio,
    autoHandleInterruptions: true,
  });

  await Player.updateOptions({
    android: {
      alwaysPauseOnInterruption: true,
    },
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.JumpForward,
      Capability.JumpBackward,
    ],
    notificationCapabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.JumpBackward,
      Capability.JumpForward,
    ],
    forwardJumpInterval: 10,
    backwardJumpInterval: 10,
    progressUpdateEventInterval: 1,
  });

  console.debug("[Controls] TrackPlayer setup succeeded");
}

/**
 * Load media and start playing with full state management.
 * Handles setting loading state, expanding player, querying playthrough state,
 * and calling appropriate loader function.
 */
export async function loadAndPlayMedia(session: Session, mediaId: string) {
  console.debug("[Controls] Loading and playing media:", mediaId);

  usePlayerUIState.setState({ loadingNewMedia: true });
  await expandPlayerAndWait();

  try {
    const inProgress = await getInProgressPlaythrough(session, mediaId);
    const result = inProgress
      ? await Loader.continuePlaythrough(session, inProgress.id)
      : await Loader.startNewPlaythrough(session, mediaId);

    applyTrackLoadResult(result);
  } catch (error) {
    console.error("[Controls] Failed to load and play media:", error);
    usePlayerUIState.setState({ loadingNewMedia: false });
  }
}

/**
 * Continue an existing in-progress playthrough.
 */
export async function continueExistingPlaythrough(
  session: Session,
  playthroughId: string,
) {
  console.debug("[Controls] Continuing existing playthrough:", playthroughId);

  usePlayerUIState.setState({ loadingNewMedia: true });
  await expandPlayerAndWait();

  try {
    const result = await Loader.continuePlaythrough(session, playthroughId);
    applyTrackLoadResult(result);
  } catch (error) {
    console.error("[Controls] Failed to continue playthrough:", error);
    usePlayerUIState.setState({ loadingNewMedia: false });
  }
}

/**
 * Start a fresh playthrough for media with no existing playthrough.
 */
export async function startFreshPlaythrough(session: Session, mediaId: string) {
  console.debug("[Controls] Starting fresh playthrough for media:", mediaId);

  usePlayerUIState.setState({ loadingNewMedia: true });
  await expandPlayerAndWait();

  try {
    const result = await Loader.startNewPlaythrough(session, mediaId);
    applyTrackLoadResult(result);
  } catch (error) {
    console.error("[Controls] Failed to start playthrough:", error);
    usePlayerUIState.setState({ loadingNewMedia: false });
  }
}

/**
 * Apply a track load result to the player UI state.
 */
function applyTrackLoadResult(result: Loader.TrackLoadResult) {
  usePlayerUIState.setState({
    loadingNewMedia: false,
    loadedPlaythrough: {
      mediaId: result.mediaId,
      playthroughId: result.playthroughId,
    },
    duration: result.duration,
    position: result.position,
    playbackRate: result.playbackRate,
    streaming: result.streaming,
    ...initialChapterState(result.chapters, result.position, result.duration),
  });
}

/**
 * Reload the currently loaded playthrough if it matches the given mediaId.
 */
export async function reloadCurrentPlaythroughIfMedia(
  session: Session,
  mediaId: string,
): Promise<void> {
  const { loadedPlaythrough } = usePlayerUIState.getState();

  if (!loadedPlaythrough || loadedPlaythrough.mediaId !== mediaId) {
    return;
  }

  console.debug(
    "[Controls] Reloading current playthrough for media:",
    mediaId,
    "playthroughId:",
    loadedPlaythrough.playthroughId,
  );

  await pauseIfPlaying();
  await Heartbeat.saveNow();

  const track = await Loader.reloadPlaythroughById(
    session,
    loadedPlaythrough.playthroughId,
  );

  usePlayerUIState.setState({
    loadedPlaythrough: {
      mediaId: track.mediaId,
      playthroughId: track.playthroughId,
    },
    duration: track.duration,
    position: track.position,
    playbackRate: track.playbackRate,
    streaming: track.streaming,
    ...initialChapterState(track.chapters, track.position, track.duration),
  });

  if (track.playthroughId === loadedPlaythrough.playthroughId) {
    await play();
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

  usePlayerUIState.setState({ loadingNewMedia: true });
  await expandPlayerAndWait();

  try {
    const result = await Loader.resumePlaythrough(session, playthroughId);

    usePlayerUIState.setState({
      loadingNewMedia: false,
      loadedPlaythrough: {
        mediaId: result.mediaId,
        playthroughId: result.playthroughId,
      },
      duration: result.duration,
      position: result.position,
      playbackRate: result.playbackRate,
      streaming: result.streaming,
      ...initialChapterState(result.chapters, result.position, result.duration),
    });
  } catch (error) {
    console.error("[Controls] Failed to resume playthrough:", error);
    usePlayerUIState.setState({ loadingNewMedia: false });
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
  const { loadedPlaythrough } = usePlayerUIState.getState();
  const isLoaded = loadedPlaythrough?.playthroughId === playthroughId;

  if (isLoaded) {
    const paused = await Coordinator.pauseAndRecordEvent();
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
  const { loadedPlaythrough } = usePlayerUIState.getState();
  const isLoaded = loadedPlaythrough?.playthroughId === playthroughId;

  if (isLoaded) {
    const paused = await Coordinator.pauseAndRecordEvent();
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
  try {
    // There were seek timers here, but they are now managed by seek-service.ts
    // We just need to ensure playback is paused and player is reset.
    await pauseIfPlaying();
    await Player.reset();
    resetPlayerUIState();
  } catch (error) {
    console.warn("[Controls] tryUnloadPlayer error", error);
  }
}

/**
 * Forcefully unloads the player without pausing.
 * Used for session cleanup during sign-out.
 */
export async function forceUnloadPlayer() {
  try {
    // There were seek timers here, but they are now managed by seek-service.ts
    await Player.reset();
    resetPlayerUIState();
  } catch (error) {
    console.warn("[Controls] forceUnloadPlayer error", error);
  }
}

// =============================================================================
// Player UI Expansion
// =============================================================================

/**
 * Requests the UI to expand the player.
 */
export function expandPlayer() {
  Coordinator.expandPlayer();
}

/**
 * Expands the player UI and waits for the animation to complete.
 */
export function expandPlayerAndWait(): Promise<void> {
  Coordinator.expandPlayer();
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
