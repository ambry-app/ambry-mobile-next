import { PAUSE_REWIND_SECONDS } from "@/constants";
import * as EventRecording from "@/services/event-recording";
import * as Lifecycle from "@/services/playthrough-lifecycle";
import * as Heartbeat from "@/services/position-heartbeat";
import { seekImmediateNoLog, seekRelative } from "@/services/seek-service";
import * as SleepTimer from "@/services/sleep-timer-service";
import * as Player from "@/services/trackplayer-wrapper";
import { Event } from "@/services/trackplayer-wrapper";
import { initializeDevice } from "@/stores/device";
import { SeekSource, usePlayerUIState } from "@/stores/player-ui-state";
import { useSession } from "@/stores/session";

import { syncPlaythroughs } from "./sync-service";

export const PlaybackService = async function () {
  console.debug("[TrackPlayer Service] Initializing");

  // TrackPlayer Events

  // Player.addEventListener(Event.AndroidConnectorConnected, (args) => {
  //   console.debug("[TrackPlayer Service] AndroidConnectorConnected", args);
  // });

  // Player.addEventListener(Event.AndroidConnectorDisconnected, (args) => {
  //   console.debug("[TrackPlayer Service] AndroidConnectorDisconnected", args);
  // });

  // Player.addEventListener(Event.MetadataChapterReceived, (args) => {
  //   console.debug("[TrackPlayer Service] MetadataChapterReceived", args);
  // });

  // Player.addEventListener(Event.MetadataCommonReceived, (args) => {
  //   console.debug("[TrackPlayer Service] MetadataCommonReceived", args);
  // });

  // Player.addEventListener(Event.MetadataTimedReceived, (args) => {
  //   console.debug("[TrackPlayer Service] MetadataTimedReceived", args);
  // });

  // Player.addEventListener(Event.PlaybackActiveTrackChanged, (args) => {
  //   console.debug("[TrackPlayer Service] PlaybackActiveTrackChanged", args);
  // });

  // Player.addEventListener(Event.PlaybackError, (args) => {
  //   console.debug("[TrackPlayer Service] PlaybackError", args);
  // });

  // Player.addEventListener(Event.PlaybackPlayWhenReadyChanged, (args) => {
  //   console.debug("[TrackPlayer Service] PlaybackPlayWhenReadyChanged", args);
  // });

  // Player.addEventListener(Event.PlaybackProgressUpdated, (args) => {
  //   console.debug("[TrackPlayer Service] PlaybackProgressUpdated", args);
  // });

  Player.addEventListener(Event.PlaybackQueueEnded, async () => {
    console.debug("[TrackPlayer Service] PlaybackQueueEnded");
    const { loadedPlaythrough, playbackRate } = usePlayerUIState.getState();

    Heartbeat.stop();

    if (loadedPlaythrough) {
      try {
        const { duration } = await Player.getProgress();
        await EventRecording.recordPauseEvent(
          loadedPlaythrough.playthroughId,
          duration, // At the very end
          playbackRate,
        );

        // Auto-finish the playthrough
        console.debug(
          "[PlaybackService] Playback ended, auto-finishing playthrough",
        );
        await Lifecycle.finishPlaythrough(
          null,
          loadedPlaythrough.playthroughId,
        );
      } catch (error) {
        console.warn("[PlaybackService] Error handling queue ended:", error);
      }
    }

    SleepTimer.cancel();
  });

  // Player.addEventListener(Event.PlaybackResume, (args) => {
  //   console.debug("[TrackPlayer Service] PlaybackResume", args);
  // });

  // Player.addEventListener(Event.PlaybackState, (args) => {
  //   console.debug("[TrackPlayer Service] PlaybackState", args);
  // });

  // Player.addEventListener(Event.PlayerError, (args) => {
  //   console.debug("[TrackPlayer Service] PlayerError", args);
  // });

  // Player.addEventListener(Event.RemoteBookmark, () => {
  //   console.debug("[TrackPlayer Service] RemoteBookmark");
  // });

  // Player.addEventListener(Event.RemoteDislike, () => {
  //   console.debug("[TrackPlayer Service] RemoteDislike");
  // });

  Player.addEventListener(Event.RemoteDuck, (args) => {
    console.debug("[TrackPlayer Service] RemoteDuck", args);
    SleepTimer.reset();
  });

  Player.addEventListener(Event.RemoteJumpBackward, async (args) => {
    console.debug("[TrackPlayer Service] RemoteJumpBackward", args);
    const { interval } = args;

    seekRelative(-interval, SeekSource.REMOTE);
  });

  Player.addEventListener(Event.RemoteJumpForward, async (args) => {
    console.debug("[TrackPlayer Service] RemoteJumpForward", args);
    const { interval } = args;

    seekRelative(interval, SeekSource.REMOTE);
  });

  // Player.addEventListener(Event.RemoteLike, () => {
  //   console.debug("[TrackPlayer Service] RemoteLike");
  // });

  // Player.addEventListener(Event.RemoteNext, () => {
  //   console.debug("[TrackPlayer Service] RemoteNext");
  // });

  Player.addEventListener(Event.RemotePause, async () => {
    console.debug("[TrackPlayer Service] RemotePause");

    await Player.pause();
    await seekImmediateNoLog(-PAUSE_REWIND_SECONDS);

    Heartbeat.stop();

    const { loadedPlaythrough, playbackRate } = usePlayerUIState.getState();
    if (loadedPlaythrough) {
      try {
        const { position } = await Player.getProgress();
        await EventRecording.recordPauseEvent(
          loadedPlaythrough.playthroughId,
          position,
          playbackRate,
        );
      } catch (error) {
        console.warn(
          "[PlaybackService] Error recording remote pause event:",
          error,
        );
      }
    }

    SleepTimer.cancel();

    const session = useSession.getState().session;
    if (session) {
      // Fire and forget
      syncPlaythroughs(session).catch((error) => {
        console.warn(
          "[PlaybackService] Background sync on remote pause failed:",
          error,
        );
      });
    }
  });

  Player.addEventListener(Event.RemotePlay, async () => {
    console.debug("[TrackPlayer Service] RemotePlay");

    await Player.play();

    const { loadedPlaythrough } = usePlayerUIState.getState();
    if (loadedPlaythrough) {
      try {
        const { position } = await Player.getProgress();
        const rate = await Player.getRate();
        await EventRecording.recordPlayEvent(
          loadedPlaythrough.playthroughId,
          position,
          rate,
        );
        Heartbeat.start(loadedPlaythrough.playthroughId, rate);
      } catch (error) {
        console.warn(
          "[PlaybackService] Error recording remote play event:",
          error,
        );
      }
    }
    SleepTimer.reset();
  });

  // Player.addEventListener(Event.RemotePlayId, (args) => {
  //   console.debug("[TrackPlayer Service] RemotePlayId", args);
  // });

  // Player.addEventListener(Event.RemotePlayPause, () => {
  //   console.debug("[TrackPlayer Service] RemotePlayPause");
  // });

  // Player.addEventListener(Event.RemotePlaySearch, (args) => {
  //   console.debug("[TrackPlayer Service] RemotePlaySearch", args);
  // });

  // Player.addEventListener(Event.RemotePrevious, () => {
  //   console.debug("[TrackPlayer Service] RemotePrevious");
  // });

  // Player.addEventListener(Event.RemoteSeek, (args) => {
  //   console.debug("[TrackPlayer Service] RemoteSeek", args);
  // });

  // Player.addEventListener(Event.RemoteSetRating, (args) => {
  //   console.debug("[TrackPlayer Service] RemoteSetRating", args);
  // });

  // Player.addEventListener(Event.RemoteSkip, (args) => {
  //   console.debug("[TrackPlayer Service] RemoteSkip", args);
  // });

  // Player.addEventListener(Event.RemoteStop, () => {
  //   console.debug("[TrackPlayer Service] RemoteStop");
  // });

  // Initialize services
  // Device store must be initialized for getDeviceIdSync() to work in event recording
  await initializeDevice();
  SleepTimer.startMonitoring();
};
