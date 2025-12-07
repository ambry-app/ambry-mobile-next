import { PROGRESS_SAVE_INTERVAL } from "@/src/constants";
import { updatePlayerState } from "@/src/db/player-states";
import { useSession } from "@/src/stores/session";
import { EventBus } from "@/src/utils";
import TrackPlayer from "react-native-track-player";

let progressSaveInterval: NodeJS.Timeout | null = null;
let isInitialized = false;

/**
 * Initialize progress save service and set up event handlers
 */
export function startMonitoring() {
  if (isInitialized) return;

  isInitialized = true;
  console.debug("[Progress Save] Initializing");

  EventBus.on("playbackStarted", () => {
    startSaveInterval();
  });

  EventBus.on("playbackPaused", () => {
    stopSaveInterval();
    saveNow();
  });

  EventBus.on("playbackQueueEnded", () => {
    stopSaveInterval();
    saveNow();
  });
}

/**
 * Start the save interval (only while playing)
 */
function startSaveInterval() {
  if (progressSaveInterval) return;

  console.debug("[Progress Save] Starting save interval");
  progressSaveInterval = setInterval(() => {
    checkAndSave();
  }, PROGRESS_SAVE_INTERVAL);
}

/**
 * Stop the save interval
 */
function stopSaveInterval() {
  if (!progressSaveInterval) return;

  console.debug("[Progress Save] Stopping save interval");
  clearInterval(progressSaveInterval);
  progressSaveInterval = null;
}

/**
 * Stop monitoring playback position
 */
export function stopMonitoring() {
  if (progressSaveInterval) {
    console.debug("[Progress Save] Stopping monitoring");
    clearInterval(progressSaveInterval);
    progressSaveInterval = null;
  }
}

/**
 * Check current playback position and save to database
 */
async function checkAndSave() {
  try {
    const session = useSession.getState().session;
    if (!session) return;

    // Get current track
    const track = await TrackPlayer.getTrack(0);
    if (!track) return;

    // MediaId is stored in the track description
    const mediaId = track.description;
    if (!mediaId) return;

    // Get current position and duration
    const { position, duration } = await TrackPlayer.getProgress();

    // Skip if no meaningful progress (duration not loaded yet)
    if (duration === 0) return;

    // Mimic server-side logic by computing the status
    const status =
      position < 60
        ? "not_started"
        : duration - position < 120
          ? "finished"
          : "in_progress";

    console.debug(
      "[Progress Save] Saving position",
      position.toFixed(1),
      "/",
      duration.toFixed(1),
      "status:",
      status,
    );

    await updatePlayerState(session, mediaId, { position, status });
  } catch (error) {
    console.warn("[Progress Save] Error saving position:", error);
  }
}

/**
 * Immediately save current position (for use on pause/finish)
 */
export async function saveNow() {
  await checkAndSave();
}
