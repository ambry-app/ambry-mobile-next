import { updatePlayerState } from "@/src/db/playerStates";
import TrackPlayer, { Event } from "react-native-track-player";
import { syncUp } from "../db/sync";
import { usePlayer } from "../stores/player";
import { useSession } from "../stores/session";

async function updatePlayerStateFromTrackPlayer() {
  const progress = await TrackPlayer.getProgress();
  const session = useSession.getState().session;
  const mediaId = usePlayer.getState().mediaId;

  if (!session || !mediaId) return;

  updatePlayerState(session, mediaId, {
    position: progress.position,
  });
}

export const PlaybackService = async function () {
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
    // TODO:
    console.debug("Service: playback queue ended");
  });

  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    console.debug("Service: stopping");
    await TrackPlayer.pause();
    await updatePlayerStateFromTrackPlayer();
  });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    console.debug("Service: pausing");
    await TrackPlayer.pause();
    updatePlayerStateFromTrackPlayer();
  });

  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    console.debug("Service: playing");
    TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, (interval) => {
    console.debug("Service: jump backward", interval);

    // TODO:
    // await seekRelative(REMOTE_JUMP_INTERVAL * -1)
    // updatePlayerStateFromTrackPlayer();
  });

  TrackPlayer.addEventListener(Event.RemoteJumpForward, (interval) => {
    console.debug("Service: jump forward", interval);

    // TODO:
    // await seekRelative(REMOTE_JUMP_INTERVAL)
    // updatePlayerStateFromTrackPlayer();
  });

  TrackPlayer.addEventListener(
    Event.PlaybackProgressUpdated,
    async (data): Promise<void> => {
      console.debug("Service: playback progress updated", data);
      const session = useSession.getState().session;
      const mediaId = usePlayer.getState().mediaId;

      if (!session || !mediaId) return;

      await updatePlayerState(session, mediaId, {
        position: data.position,
      });

      await syncUp(session);
    },
  );
};
