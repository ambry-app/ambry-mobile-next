import { PAUSE_REWIND_SECONDS } from "@/constants";
import * as Coordinator from "@/services/playback-coordinator";
import {
  seekImmediateNoLog,
  seekRelative,
  SeekSource,
} from "@/services/seek-service";
import * as Player from "@/services/trackplayer-wrapper";
import { Event } from "@/services/trackplayer-wrapper";
import { initializeDevice } from "@/stores/device";
import { setProgress } from "@/stores/player-ui-state";

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

  Player.addEventListener(Event.PlaybackQueueEnded, () => {
    console.debug("[TrackPlayer Service] PlaybackQueueEnded");
    Coordinator.onQueueEnded();
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
    Coordinator.onRemoteDuck();
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
    Coordinator.onPause();
  });

  Player.addEventListener(Event.RemotePlay, async () => {
    console.debug("[TrackPlayer Service] RemotePlay");

    await Player.play();
    Coordinator.onPlay();
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
  Coordinator.setPlayerProgressUpdater(setProgress);
  Coordinator.initialize();
};
