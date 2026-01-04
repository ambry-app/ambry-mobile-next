import TrackPlayer, {
  AddTrack,
  Event,
  State,
  Track,
} from "react-native-track-player";

import { getPlaythrough } from "@/db/playthroughs";
import { useDataVersion } from "@/stores/data-version";
import { useSession } from "@/stores/session";
import {
  type ProgressWithPercent,
  useTrackPlayer,
} from "@/stores/track-player";

let progressCheckInterval: NodeJS.Timeout | null = null;

// =============================================================================
// Public API
// =============================================================================

export function initialize() {
  if (isInitialized()) {
    console.debug("[TrackPlayer Service] Already initialized");
    return;
  }

  console.debug("[TrackPlayer Service] Initializing...");

  // playbackState
  TrackPlayer.getPlaybackState().then((playbackState) => {
    useTrackPlayer.setState({ playbackState });
    updateIsPlaying();
  });

  TrackPlayer.addEventListener(Event.PlaybackState, (state) => {
    useTrackPlayer.setState({ playbackState: state });
    updateIsPlaying();
  });

  // playWhenReady
  TrackPlayer.getPlayWhenReady().then((playWhenReady) => {
    useTrackPlayer.setState({ playWhenReady });
    updateIsPlaying();
  });

  TrackPlayer.addEventListener(Event.PlaybackPlayWhenReadyChanged, (event) => {
    useTrackPlayer.setState({ playWhenReady: event.playWhenReady });
    updateIsPlaying();
  });

  // track
  TrackPlayer.getActiveTrack().then((track) => {
    updateTrack(track);
  });

  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (event) => {
    updateTrack(event.track);
  });

  // playthrough data version changes
  useDataVersion.subscribe((state, prevState) => {
    if (state.playthroughDataVersion === prevState.playthroughDataVersion)
      // no change
      return;

    const { playthrough } = useTrackPlayer.getState();
    // no playthrough to update
    if (!playthrough) return;

    updatePlaythrough(playthrough.id);
  });

  // Done
  useTrackPlayer.setState({ initialized: true });
  console.debug("[TrackPlayer Service] Initialized");
}

// Playback Control

export async function play() {
  console.debug("[TrackPlayer Service] play");
  return TrackPlayer.play();
}

export async function pause() {
  console.debug("[TrackPlayer Service] pause");
  return TrackPlayer.pause();
}

export async function seekTo(position: number) {
  console.debug("[TrackPlayer Service] seekTo", position.toFixed(1));
  await TrackPlayer.seekTo(position);
  const progress = await getProgressWithPercent();
  useTrackPlayer.setState({ progress });
}

export async function setRate(rate: number) {
  console.debug("[TrackPlayer Service] setRate", rate);
  await TrackPlayer.setRate(rate);
  const currentRate = await TrackPlayer.getRate();
  useTrackPlayer.setState({ playbackRate: currentRate });
}

export async function setVolume(volume: number) {
  console.debug("[TrackPlayer Service] setVolume", volume);
  return TrackPlayer.setVolume(volume);
}

// State Queries

export function isInitialized() {
  return useTrackPlayer.getState().initialized;
}

// FIXME: is this needed?
// export async function getProgress() {
//   console.debug("[TrackPlayer Service] getProgress");
//   const { progress } = useTrackPlayer.getState();

//   if (progress) {
//     return progress;
//   }

//   return getProgressWithPercent();
// }

export async function getAccurateProgress() {
  console.debug("[TrackPlayer Service] getAccurateProgress");
  return getProgressWithPercent();
}

export async function getPlaybackRate() {
  console.debug("[TrackPlayer Service] getPlaybackRate");
  const { playbackRate } = useTrackPlayer.getState();
  return playbackRate;
}

export function isPlaying() {
  console.debug("[TrackPlayer Service] isPlaying");
  const { isPlaying } = useTrackPlayer.getState();
  return isPlaying;
}

// Queue Management

export async function reset() {
  console.debug("[TrackPlayer Service] reset");
  return TrackPlayer.reset();
}

export async function add(track: AddTrack) {
  console.debug("[TrackPlayer Service] add", track.title);
  return TrackPlayer.add(track);
}

export async function getTrack(index: number): Promise<Track | undefined> {
  console.debug("[TrackPlayer Service] getTrack", index);
  return TrackPlayer.getTrack(index);
}

// Event Listeners (used by playback-service.ts)

export function addEventListener<T extends Event>(
  event: T,
  handler: Parameters<typeof TrackPlayer.addEventListener<T>>[1],
) {
  console.debug("[TrackPlayer Service] addEventListener", event);
  return TrackPlayer.addEventListener(event, handler);
}

// Setup

export async function setupPlayer(
  options: Parameters<typeof TrackPlayer.setupPlayer>[0],
) {
  console.debug("[TrackPlayer Service] setupPlayer");
  return TrackPlayer.setupPlayer(options);
}

export async function updateOptions(
  options: Parameters<typeof TrackPlayer.updateOptions>[0],
) {
  console.debug("[TrackPlayer Service] updateOptions");
  return TrackPlayer.updateOptions(options);
}

export function registerPlaybackService(
  factory: () => () => Promise<void>,
): void {
  console.debug("[TrackPlayer Service] registerPlaybackService");
  TrackPlayer.registerPlaybackService(factory);
}

// =============================================================================
// Internals
// =============================================================================

function updateTrack(track?: Track) {
  if (!track) {
    useTrackPlayer.setState({ streaming: undefined, playthrough: undefined });
    return;
  }

  const streaming = track.url?.startsWith("http");
  useTrackPlayer.setState({ streaming });

  const playthroughId = track.description;
  updatePlaythrough(playthroughId);
}

async function updatePlaythrough(playthroughId?: string) {
  const { session } = useSession.getState();

  if (!session || !playthroughId) {
    // This shouldn't happen
    console.warn(
      "[TrackPlayer Service] updatePlaythrough: Missing session or playthroughId",
    );
    useTrackPlayer.setState({ playthrough: undefined });
    return;
  }

  const playthrough = await getPlaythrough(session, playthroughId);
  if (!playthrough) {
    // This shouldn't happen
    console.warn(
      `[TrackPlayer Service] updatePlaythrough: No playthrough found for ID ${playthroughId}`,
    );
  }

  useTrackPlayer.setState({ playthrough });
}

function updateIsPlaying() {
  const { playWhenReady, playbackState } = useTrackPlayer.getState();
  const isPlaying = determineIsPlaying(playWhenReady, playbackState.state);
  useTrackPlayer.setState({ isPlaying });

  if (isPlaying.playing) {
    startTrackingProgress();
  } else {
    stopTrackingProgress();
  }
}

// copied from: node_modules/react-native-track-player/src/hooks/useIsPlaying.ts
function determineIsPlaying(playWhenReady: boolean, state: State) {
  const isLoading = state === State.Loading || state === State.Buffering;
  const isErrored = state === State.Error;
  const isEnded = state === State.Ended;
  const isNone = state === State.None;

  return {
    playing: playWhenReady && !(isErrored || isEnded || isNone),
    bufferingDuringPlay: playWhenReady && isLoading,
  };
}

async function getProgressWithPercent(): Promise<ProgressWithPercent> {
  const progress = await getProgressWaitForDuration();
  const progressPercent =
    progress.duration > 0 ? (progress.position / progress.duration) * 100 : 0;

  return {
    ...progress,
    percent: progressPercent,
  };
}

async function getProgressWaitForDuration(timeoutMs: number = 2000) {
  const startTime = Date.now();
  const pollIntervalMs = 50;

  while (Date.now() - startTime < timeoutMs) {
    const progress = await TrackPlayer.getProgress();

    if (progress.duration > 0) {
      return progress;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  // Timeout reached without getting a valid duration
  console.warn(
    "[TrackPlayer Service] getProgressWaitForDuration: Timeout reached while waiting for valid duration",
  );
  const progress = await TrackPlayer.getProgress();
  return progress;
}

function startTrackingProgress() {
  if (progressCheckInterval) {
    return;
  }

  progressCheckInterval = setInterval(async () => {
    const progress = await getProgressWithPercent();
    useTrackPlayer.setState({ progress });
  }, 1000);
}

function stopTrackingProgress() {
  if (progressCheckInterval) {
    clearInterval(progressCheckInterval);
    progressCheckInterval = null;
  }
}

// Debug: Log state changes
// useTrackPlayer.subscribe((state) => {
//   console.debug(
//     "[TrackPlayer Store] State changed:",
//     JSON.stringify(state, null, 2),
//   );
// });
