import {
  pause,
  play,
  seekRelative,
  updateProgress,
  updateState,
} from "@/src/stores/player";
import TrackPlayer, { Event } from "react-native-track-player";

export const PlaybackService = async function () {
  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    console.debug("[TrackPlayer Service] remote stop requested");
    pause();
  });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    console.debug("[TrackPlayer Service] remote pause requested");
    pause();
  });

  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    console.debug("[TrackPlayer Service] remote play requested");
    play();
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, ({ interval }) => {
    console.debug(
      "[TrackPlayer Service] remote jump backward requested",
      -interval,
    );
    seekRelative(-interval);
  });

  TrackPlayer.addEventListener(Event.RemoteJumpForward, ({ interval }) => {
    console.debug(
      "[TrackPlayer Service] remote jump forward requested",
      interval,
    );
    seekRelative(interval);
  });

  TrackPlayer.addEventListener(
    Event.PlaybackProgressUpdated,
    async ({ position, duration }) => {
      updateProgress(position, duration);
    },
  );

  TrackPlayer.addEventListener(Event.PlaybackState, async ({ state }) => {
    console.debug("[TrackPlayer Service] playback state changed", state);
    updateState(state);
  });
};
