import { PAUSE_REWIND_SECONDS } from "@/constants";
import * as Operations from "@/services/playthrough-operations";
import { seekRelative } from "@/services/seek-service";
import * as Player from "@/services/track-player-service";
import * as TrackPlayer from "@/services/track-player-wrapper";
import { PlayPauseSource, SeekSource } from "@/stores/track-player";
import { Event } from "@/types/track-player";
import { logBase } from "@/utils/logger";

const log = logBase.extend("playback-service");

export const PlaybackService = async function () {
  log.info("Initializing");

  // TrackPlayer Events

  // TrackPlayer.addEventListener(Event.AndroidConnectorConnected, (args) => {
  //   log.debug("AndroidConnectorConnected", args);
  // });

  // TrackPlayer.addEventListener(Event.AndroidConnectorDisconnected, (args) => {
  //   log.debug("AndroidConnectorDisconnected", args);
  // });

  // TrackPlayer.addEventListener(Event.MetadataChapterReceived, (args) => {
  //   log.debug("MetadataChapterReceived", args);
  // });

  // TrackPlayer.addEventListener(Event.MetadataCommonReceived, (args) => {
  //   log.debug("MetadataCommonReceived", args);
  // });

  // TrackPlayer.addEventListener(Event.MetadataTimedReceived, (args) => {
  //   log.debug("MetadataTimedReceived", args);
  // });

  // TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (args) => {
  //   log.debug("PlaybackActiveTrackChanged", args);
  // });

  // TrackPlayer.addEventListener(Event.PlaybackError, (args) => {
  //   log.debug("PlaybackError", args);
  // });

  // TrackPlayer.addEventListener(Event.PlaybackPlayWhenReadyChanged, (args) => {
  //   log.debug("PlaybackPlayWhenReadyChanged", args);
  // });

  // TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (args) => {
  //   log.debug("PlaybackProgressUpdated", args);
  // });

  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {
    log.debug("PlaybackQueueEnded");

    const loadedPlaythrough = Player.getLoadedPlaythrough();

    if (!loadedPlaythrough) {
      log.warn("No loaded playthrough when handling queue end");
      return;
    }

    // Auto-finish the playthrough
    log.info("Playback ended, auto-finishing playthrough");
    await Operations.finishPlaythrough(null, loadedPlaythrough.id);
  });

  // TrackPlayer.addEventListener(Event.PlaybackResume, (args) => {
  //   log.debug("PlaybackResume", args);
  // });

  // TrackPlayer.addEventListener(Event.PlaybackState, (args) => {
  //   log.debug("PlaybackState", args);
  // });

  // TrackPlayer.addEventListener(Event.PlayerError, (args) => {
  //   log.debug("PlayerError", args);
  // });

  // TrackPlayer.addEventListener(Event.RemoteBookmark, () => {
  //   log.debug("RemoteBookmark");
  // });

  // TrackPlayer.addEventListener(Event.RemoteDislike, () => {
  //   log.debug("RemoteDislike");
  // });

  // FIXME: this event doesn't seem to work on Android
  TrackPlayer.addEventListener(Event.RemoteDuck, (args) => {
    log.debug("RemoteDuck", args);
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (args) => {
    log.debug("RemoteJumpBackward", args);
    const { interval } = args;

    seekRelative(-interval, SeekSource.REMOTE);
  });

  TrackPlayer.addEventListener(Event.RemoteJumpForward, async (args) => {
    log.debug("RemoteJumpForward", args);
    const { interval } = args;

    seekRelative(interval, SeekSource.REMOTE);
  });

  // TrackPlayer.addEventListener(Event.RemoteLike, () => {
  //   log.debug("RemoteLike");
  // });

  // TrackPlayer.addEventListener(Event.RemoteNext, () => {
  //   log.debug("RemoteNext");
  // });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    log.debug("RemotePause");

    await Player.pause(PlayPauseSource.REMOTE, PAUSE_REWIND_SECONDS);
  });

  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    log.debug("RemotePlay");

    await Player.play(PlayPauseSource.REMOTE);
  });

  // TrackPlayer.addEventListener(Event.RemotePlayId, (args) => {
  //   log.debug("RemotePlayId", args);
  // });

  // TrackPlayer.addEventListener(Event.RemotePlayPause, () => {
  //   log.debug("RemotePlayPause");
  // });

  // TrackPlayer.addEventListener(Event.RemotePlaySearch, (args) => {
  //   log.debug("RemotePlaySearch", args);
  // });

  // TrackPlayer.addEventListener(Event.RemotePrevious, () => {
  //   log.debug("RemotePrevious");
  // });

  // TrackPlayer.addEventListener(Event.RemoteSeek, (args) => {
  //   log.debug("RemoteSeek", args);
  // });

  // TrackPlayer.addEventListener(Event.RemoteSetRating, (args) => {
  //   log.debug("RemoteSetRating", args);
  // });

  // TrackPlayer.addEventListener(Event.RemoteSkip, (args) => {
  //   log.debug("RemoteSkip", args);
  // });

  // TrackPlayer.addEventListener(Event.RemoteStop, () => {
  //   log.debug("RemoteStop");
  // });
};
