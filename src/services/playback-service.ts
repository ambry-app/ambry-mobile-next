import { PAUSE_REWIND_SECONDS } from "@/constants";
import * as Operations from "@/services/playthrough-operations";
import { seekRelative, seekTo } from "@/services/seek-service";
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

  // There is no RemotePlayPause listener any more, on purpose. RNTP swallowed
  // the headset's KEYCODE_MEDIA_PLAY_PAUSE and left JS to resolve the toggle;
  // media3's session resolves it against `playWhenReady` itself, so a headset
  // key arrives here as the RemotePlay or RemotePause it meant.

  // TrackPlayer.addEventListener(Event.RemotePlaySearch, (args) => {
  //   log.debug("RemotePlaySearch", args);
  // });

  // TrackPlayer.addEventListener(Event.RemotePrevious, () => {
  //   log.debug("RemotePrevious");
  // });

  // The lock-screen seekbar. RNTP never advertised in-track seeking so the
  // bar was inert; the new module does, and the wrapper has already
  // translated the dragged position into book seconds.
  TrackPlayer.addEventListener(Event.RemoteSeek, async (args) => {
    log.debug("RemoteSeek", args);
    const { position } = args;

    seekTo(position, SeekSource.REMOTE);
  });

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
