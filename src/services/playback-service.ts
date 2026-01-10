import { PAUSE_REWIND_SECONDS } from "@/constants";
import * as Lifecycle from "@/services/playthrough-lifecycle";
import { seekImmediateNoLog, seekRelative } from "@/services/seek-service";
import * as Player from "@/services/track-player-service";
import * as TrackPlayer from "@/services/track-player-wrapper";
import { initializeDevice } from "@/stores/device";
import { PlayPauseSource, SeekSource } from "@/stores/track-player";
import { Event } from "@/types/track-player";

export const PlaybackService = async function () {
  console.debug("[TrackPlayer Service] Initializing");

  // TrackPlayer Events

  // TrackPlayer.addEventListener(Event.AndroidConnectorConnected, (args) => {
  //   console.debug("[TrackPlayer Service] AndroidConnectorConnected", args);
  // });

  // TrackPlayer.addEventListener(Event.AndroidConnectorDisconnected, (args) => {
  //   console.debug("[TrackPlayer Service] AndroidConnectorDisconnected", args);
  // });

  // TrackPlayer.addEventListener(Event.MetadataChapterReceived, (args) => {
  //   console.debug("[TrackPlayer Service] MetadataChapterReceived", args);
  // });

  // TrackPlayer.addEventListener(Event.MetadataCommonReceived, (args) => {
  //   console.debug("[TrackPlayer Service] MetadataCommonReceived", args);
  // });

  // TrackPlayer.addEventListener(Event.MetadataTimedReceived, (args) => {
  //   console.debug("[TrackPlayer Service] MetadataTimedReceived", args);
  // });

  // TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (args) => {
  //   console.debug("[TrackPlayer Service] PlaybackActiveTrackChanged", args);
  // });

  // TrackPlayer.addEventListener(Event.PlaybackError, (args) => {
  //   console.debug("[TrackPlayer Service] PlaybackError", args);
  // });

  // TrackPlayer.addEventListener(Event.PlaybackPlayWhenReadyChanged, (args) => {
  //   console.debug("[TrackPlayer Service] PlaybackPlayWhenReadyChanged", args);
  // });

  // TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (args) => {
  //   console.debug("[TrackPlayer Service] PlaybackProgressUpdated", args);
  // });

  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {
    console.debug("[TrackPlayer Service] PlaybackQueueEnded");

    const loadedPlaythrough = Player.getLoadedPlaythrough();

    if (!loadedPlaythrough) {
      console.warn(
        "[PlaybackService] No loaded playthrough when handling queue end",
      );
      return;
    }

    // Auto-finish the playthrough
    console.debug(
      "[PlaybackService] Playback ended, auto-finishing playthrough",
    );
    await Lifecycle.finishPlaythrough(null, loadedPlaythrough.id);
  });

  // TrackPlayer.addEventListener(Event.PlaybackResume, (args) => {
  //   console.debug("[TrackPlayer Service] PlaybackResume", args);
  // });

  // TrackPlayer.addEventListener(Event.PlaybackState, (args) => {
  //   console.debug("[TrackPlayer Service] PlaybackState", args);
  // });

  // TrackPlayer.addEventListener(Event.PlayerError, (args) => {
  //   console.debug("[TrackPlayer Service] PlayerError", args);
  // });

  // TrackPlayer.addEventListener(Event.RemoteBookmark, () => {
  //   console.debug("[TrackPlayer Service] RemoteBookmark");
  // });

  // TrackPlayer.addEventListener(Event.RemoteDislike, () => {
  //   console.debug("[TrackPlayer Service] RemoteDislike");
  // });

  // FIXME: this event doesn't seem to work on Android
  TrackPlayer.addEventListener(Event.RemoteDuck, (args) => {
    console.debug("[TrackPlayer Service] RemoteDuck", args);
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (args) => {
    console.debug("[TrackPlayer Service] RemoteJumpBackward", args);
    const { interval } = args;

    seekRelative(-interval, SeekSource.REMOTE);
  });

  TrackPlayer.addEventListener(Event.RemoteJumpForward, async (args) => {
    console.debug("[TrackPlayer Service] RemoteJumpForward", args);
    const { interval } = args;

    seekRelative(interval, SeekSource.REMOTE);
  });

  // TrackPlayer.addEventListener(Event.RemoteLike, () => {
  //   console.debug("[TrackPlayer Service] RemoteLike");
  // });

  // TrackPlayer.addEventListener(Event.RemoteNext, () => {
  //   console.debug("[TrackPlayer Service] RemoteNext");
  // });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    console.debug("[TrackPlayer Service] RemotePause");

    await Player.pause(PlayPauseSource.REMOTE);
    await seekImmediateNoLog(-PAUSE_REWIND_SECONDS);
  });

  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    console.debug("[TrackPlayer Service] RemotePlay");

    await Player.play(PlayPauseSource.REMOTE);
  });

  // TrackPlayer.addEventListener(Event.RemotePlayId, (args) => {
  //   console.debug("[TrackPlayer Service] RemotePlayId", args);
  // });

  // TrackPlayer.addEventListener(Event.RemotePlayPause, () => {
  //   console.debug("[TrackPlayer Service] RemotePlayPause");
  // });

  // TrackPlayer.addEventListener(Event.RemotePlaySearch, (args) => {
  //   console.debug("[TrackPlayer Service] RemotePlaySearch", args);
  // });

  // TrackPlayer.addEventListener(Event.RemotePrevious, () => {
  //   console.debug("[TrackPlayer Service] RemotePrevious");
  // });

  // TrackPlayer.addEventListener(Event.RemoteSeek, (args) => {
  //   console.debug("[TrackPlayer Service] RemoteSeek", args);
  // });

  // TrackPlayer.addEventListener(Event.RemoteSetRating, (args) => {
  //   console.debug("[TrackPlayer Service] RemoteSetRating", args);
  // });

  // TrackPlayer.addEventListener(Event.RemoteSkip, (args) => {
  //   console.debug("[TrackPlayer Service] RemoteSkip", args);
  // });

  // TrackPlayer.addEventListener(Event.RemoteStop, () => {
  //   console.debug("[TrackPlayer Service] RemoteStop");
  // });

  // Initialize services
  // Device store must be initialized for getDeviceIdSync() to work in event recording
  await initializeDevice();
};
