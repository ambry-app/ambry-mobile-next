import { PAUSE_REWIND_SECONDS } from "@/constants";
import * as EventRecording from "@/services/event-recording";
import * as Lifecycle from "@/services/playthrough-lifecycle";
import * as Heartbeat from "@/services/position-heartbeat";
import { seekImmediateNoLog, seekRelative } from "@/services/seek-service";
import * as SleepTimer from "@/services/sleep-timer-service";
import * as Player from "@/services/track-player-service";
import { initializeDevice } from "@/stores/device";
import { SeekSource } from "@/stores/player-ui-state";
import { useSession } from "@/stores/session";
import { useTrackPlayer } from "@/stores/track-player";
import { Event } from "@/types/track-player";

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

    Heartbeat.stop();
    SleepTimer.stop();

    const { playthrough } = useTrackPlayer.getState();

    if (!playthrough) {
      console.warn(
        "[PlaybackService] No loaded playthrough when handling queue end",
      );
      return;
    }

    const playbackRate = await Player.getPlaybackRate();
    const progress = await Player.getAccurateProgress();

    await EventRecording.recordPauseEvent(
      playthrough.id,
      progress.duration,
      playbackRate,
    );

    // Auto-finish the playthrough
    console.debug(
      "[PlaybackService] Playback ended, auto-finishing playthrough",
    );
    await Lifecycle.finishPlaythrough(null, playthrough.id);
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

  // FIXME: this event doesn't seem to work
  Player.addEventListener(Event.RemoteDuck, (args) => {
    console.debug("[TrackPlayer Service] RemoteDuck", args);
    SleepTimer.maybeResetTriggerTime();
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

    Heartbeat.stop();
    SleepTimer.stop();

    await Player.pause();
    await seekImmediateNoLog(-PAUSE_REWIND_SECONDS);

    const { playthrough } = useTrackPlayer.getState();

    if (!playthrough) {
      console.warn(
        "[PlaybackService] No loaded playthrough when handling remote pause",
      );
      return;
    }

    const playbackRate = await Player.getPlaybackRate();
    const progress = await Player.getAccurateProgress();

    await EventRecording.recordPauseEvent(
      playthrough.id,
      progress.position,
      playbackRate,
    );

    const { session } = useSession.getState();

    if (!session) {
      console.warn(
        "[PlaybackService] No session when handling remote pause, cannot sync",
      );
      return;
    }

    syncPlaythroughs(session);
  });

  Player.addEventListener(Event.RemotePlay, async () => {
    console.debug("[TrackPlayer Service] RemotePlay");

    await Player.play();

    SleepTimer.start();

    const { playthrough } = useTrackPlayer.getState();

    if (!playthrough) {
      console.warn(
        "[PlaybackService] No loaded playthrough when handling remote play",
      );
      return;
    }

    const playbackRate = await Player.getPlaybackRate();

    Heartbeat.start(playthrough.id, playbackRate);

    const progress = await Player.getAccurateProgress();

    await EventRecording.recordPlayEvent(
      playthrough.id,
      progress.position,
      playbackRate,
    );
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
};
