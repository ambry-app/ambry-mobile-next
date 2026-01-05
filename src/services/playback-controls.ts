import { useEffect } from "react";
import { AppStateStatus, EmitterSubscription } from "react-native";

import {
  PAUSE_REWIND_SECONDS,
  PLAYER_EXPAND_ANIMATION_DURATION,
} from "@/constants";
import {
  deletePlaythrough as deletePlaythroughDb,
  getInProgressPlaythrough,
  getPlaythroughWithMedia,
} from "@/db/playthroughs";
import { bumpPlaythroughDataVersion } from "@/stores/data-version";
import {
  initialChapterState,
  requestExpandPlayer,
  resetPlayerUIState,
  setProgress,
  usePlayerUIState,
} from "@/stores/player-ui-state";
import { useSession } from "@/stores/session";
import { useTrackPlayer } from "@/stores/track-player";
import { Session } from "@/types/session";
import {
  AndroidAudioContentType,
  Event,
  IOSCategory,
  IOSCategoryMode,
} from "@/types/track-player";

import * as EventRecording from "./event-recording";
import * as Lifecycle from "./playthrough-lifecycle";
import * as Loader from "./playthrough-loader";
import * as Heartbeat from "./position-heartbeat";
import { seekImmediateNoLog } from "./seek-service";
import * as SleepTimer from "./sleep-timer-service";
import { syncPlaythroughs } from "./sync-service";
import { setRate } from "./track-player-service";
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

  const loadedPlaythrough = useTrackPlayer.getState().playthrough;
  if (loadedPlaythrough) {
    try {
      const { position } = await Player.getAccurateProgress();
      const rate = await Player.getPlaybackRate();

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

  const { playthrough, playbackRate } = useTrackPlayer.getState();
  if (playthrough) {
    try {
      const { position } = await Player.getAccurateProgress();
      await EventRecording.recordPauseEvent(
        playthrough.id,
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
  const { playing } = await Player.isPlaying();
  if (playing) {
    await pause();
  }
}

/**
 * Set the playback rate.
 */
export async function setPlaybackRate(playbackRate: number) {
  const previousRate = useTrackPlayer.getState().playbackRate;

  await setRate(playbackRate);

  const loadedPlaythrough = useTrackPlayer.getState().playthrough;
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

  try {
    // Check if TrackPlayer already has a track loaded (e.g., from headless context)
    let trackLoadResult: Loader.TrackLoadResult | null = null;
    try {
      const track = await Player.getTrack(0);
      if (track) {
        const playthroughId = track.description!;
        const progress = await Player.getAccurateProgress();
        const playbackRate = await Player.getPlaybackRate();

        const playthrough = await getPlaythroughWithMedia(
          session,
          playthroughId,
        );

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
            chapters: playthrough.media.chapters,
          };
        }
      }
    } catch (e) {
      console.debug("[Controls] TrackPlayer not yet set up, proceeding:", e);
    }

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
export async function setupTrackPlayer() {
  try {
    await Player.setupPlayer({
      androidAudioContentType: AndroidAudioContentType.Speech,
      iosCategory: IOSCategory.Playback,
      iosCategoryMode: IOSCategoryMode.SpokenAudio,
      autoHandleInterruptions: true,
    });
  } catch {
    // already initialized
    return;
  }

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
    bumpPlaythroughDataVersion();
    await play();
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
    bumpPlaythroughDataVersion();
    await play();
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
    bumpPlaythroughDataVersion();
    await play();
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
    duration: result.duration,
    position: result.position,
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
  const playthrough = useTrackPlayer.getState().playthrough;

  if (!playthrough || playthrough.mediaId !== mediaId) {
    return;
  }

  console.debug(
    "[Controls] Reloading current playthrough for media:",
    mediaId,
    "playthroughId:",
    playthrough.id,
  );

  await pauseIfPlaying();
  await Heartbeat.saveNow();

  const track = await Loader.reloadPlaythroughById(session, playthrough.id);

  applyTrackLoadResult(track);

  if (track.playthroughId === playthrough.id) {
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

    applyTrackLoadResult(result);
    bumpPlaythroughDataVersion();

    await play();
  } catch (error) {
    console.error("[Controls] Failed to resume playthrough:", error);
    usePlayerUIState.setState({ loadingNewMedia: false });
  }
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
  const playthrough = useTrackPlayer.getState().playthrough;
  const isLoaded = playthrough?.id === playthroughId;

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
  const playthrough = useTrackPlayer.getState().playthrough;
  const isLoaded = playthrough?.id === playthroughId;

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
  const playthrough = useTrackPlayer.getState().playthrough;
  const isLoaded = playthrough?.id === playthroughId;

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
  const { playthrough, playbackRate } = useTrackPlayer.getState();

  if (!playthrough) return false;

  const { playing } = await Player.isPlaying();
  if (!playing) {
    console.debug("[Controls] pauseAndRecordEvent: not playing, skipping");
    return false;
  }

  try {
    await Player.pause();
    const { position } = await Player.getAccurateProgress();
    await EventRecording.recordPauseEvent(
      playthrough.id,
      position,
      playbackRate,
    );
    console.debug("[Controls] pauseAndRecordEvent completed");
    return true;
  } catch (error) {
    console.warn("[Controls] Error in pauseAndRecordEvent:", error);
    return false;
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

// =============================================================================
// Player Subscription Hook
// =============================================================================

const POSITION_POLL_INTERVAL = 1000; // 1 second for position/duration

/**
 * Subscribes to TrackPlayer events and polls for position to keep the UI
 * state in sync with the native player.
 */
export function usePlayerSubscriptions(appState: AppStateStatus) {
  const playerLoaded = useTrackPlayer((state) => !!state.playthrough);
  const { playing } = useTrackPlayer((state) => state.isPlaying);

  useEffect(() => {
    const subscriptions: EmitterSubscription[] = [];
    let positionIntervalId: NodeJS.Timeout | null = null;

    const pollPosition = async () => {
      const progress = await Player.getAccurateProgress();
      setProgress(progress.position, progress.duration);
    };

    const onPlaybackQueueEnded = () => {
      const { duration } = usePlayerUIState.getState();
      console.debug(
        "[PlayerSubscriptions] PlaybackQueueEnded at position",
        duration,
      );
      setProgress(duration, duration);
    };

    if (appState === "active" && playerLoaded) {
      console.debug("[PlayerSubscriptions] Attaching player subscriptions");
      pollPosition(); // Initial poll to get position regardless of play state

      subscriptions.push(
        Player.addEventListener(Event.PlaybackQueueEnded, onPlaybackQueueEnded),
      );

      // Only poll for position if the player is actively playing.
      if (playing) {
        console.debug(
          "[PlayerSubscriptions] Player is playing, starting position poll.",
        );
        positionIntervalId = setInterval(pollPosition, POSITION_POLL_INTERVAL);
      } else {
        console.debug(
          "[PlayerSubscriptions] Player not playing, position poll is disabled.",
        );
      }
    }

    return () => {
      if (positionIntervalId) clearInterval(positionIntervalId);
      if (subscriptions.length !== 0) {
        console.debug("[PlayerSubscriptions] Unsubscribing from player events");
        subscriptions.forEach((sub) => sub.remove());
      }
    };
  }, [appState, playerLoaded, playing]);
}
