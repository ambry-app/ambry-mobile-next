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
    console.debug("[TrackPlayer Service] remote stop");
    pause();
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    console.debug("[TrackPlayer Service] remote pause");
    pause();
  });

  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    console.debug("[TrackPlayer Service] remote play");
    play();
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, ({ interval }) => {
    console.debug("[TrackPlayer Service] remote jump backward", -interval);
    seekRelative(-interval);
  });

  TrackPlayer.addEventListener(Event.RemoteJumpForward, ({ interval }) => {
    console.debug("[TrackPlayer Service] remote jump forward", interval);
    seekRelative(interval);
  });

  TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (args) => {
    const { position, duration } = args;
    onPlaybackProgressUpdated(position, duration);
  });

  TrackPlayer.addEventListener(Event.PlaybackState, ({ state }) => {
    console.debug("[TrackPlayer Service] playback state changed", state);
    onPlaybackState(state);
  });

  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
    console.debug("[TrackPlayer Service] playback ended");
    onPlaybackQueueEnded();
  });
};
