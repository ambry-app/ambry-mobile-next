import {
  onPlaybackProgressUpdated,
  onPlaybackQueueEnded,
  onPlaybackState,
  pause,
  play,
  seekRelative,
} from "@/src/stores/player";
import TrackPlayer, { Event } from "react-native-track-player";

export const PlaybackService = async function () {
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    console.debug("[TrackPlayer Service] RemoteStop");
    pause();
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    console.debug("[TrackPlayer Service] RemotePause");
    pause();
  });

  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    console.debug("[TrackPlayer Service] RemotePlay");
    play();
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, ({ interval }) => {
    console.debug("[TrackPlayer Service] RemoteJumpBackward", -interval);
    seekRelative(-interval);
  });

  TrackPlayer.addEventListener(Event.RemoteJumpForward, ({ interval }) => {
    console.debug("[TrackPlayer Service] RemoteJumpForward", interval);
    seekRelative(interval);
  });

  TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (args) => {
    const { position, duration } = args;
    console.debug(
      "[TrackPlayer Service] PlaybackProgressUpdated",
      position,
      duration,
    );
    onPlaybackProgressUpdated(position, duration);
  });

  TrackPlayer.addEventListener(Event.PlaybackState, ({ state }) => {
    console.debug("[TrackPlayer Service] PlaybackState", state);
    onPlaybackState(state);
  });

  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
    console.debug("[TrackPlayer Service] PlaybackQueueEnded");
    onPlaybackQueueEnded();
  });
};
