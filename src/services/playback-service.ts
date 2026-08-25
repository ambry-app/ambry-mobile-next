import { PAUSE_REWIND_SECONDS } from "@/constants";
import * as Operations from "@/services/playthrough-operations";
import { seekRelative, seekTo } from "@/services/seek-service";
import * as Player from "@/services/track-player-service";
import * as TrackPlayer from "@/services/track-player-wrapper";
import { PlayPauseSource, SeekSource } from "@/stores/track-player";
import { logBase } from "@/utils/logger";

const log = logBase.extend("playback-service");

let unsubscribes: (() => void)[] = [];

/**
 * Routes the player's remote transport and queue-end into the services.
 * Remote commands arrive un-acted - JS is the actor - so a remote pause runs
 * pause-rewind before the event log sees the pause, and remote seeks go
 * through the same rate-scaled path as in-app presses. A headset's toggle
 * arrives as the play or pause it meant; the native session resolves it.
 *
 * Re-running replaces the registrations, so a repeated boot never
 * double-handles a command.
 */
export function initPlaybackService() {
  log.info("Initializing");

  unsubscribes.forEach((unsubscribe) => unsubscribe());
  unsubscribes = [];

  unsubscribes.push(
    TrackPlayer.onQueueEnded(async () => {
      log.debug("queue ended");

      const loadedPlaythrough = Player.getLoadedPlaythrough();
      if (!loadedPlaythrough) {
        log.warn("No loaded playthrough when handling queue end");
        return;
      }

      log.info("Playback ended, auto-finishing playthrough");
      await Operations.finishPlaythrough(null, loadedPlaythrough.id);
    }),
  );

  unsubscribes.push(
    TrackPlayer.onRemoteCommand(async (command) => {
      log.debug(`remote ${command.command}`);

      switch (command.command) {
        case "play":
          return Player.play(PlayPauseSource.REMOTE);
        case "pause":
          return Player.pause(PlayPauseSource.REMOTE, PAUSE_REWIND_SECONDS);
        case "seekBack":
          return seekRelative(-command.intervalSeconds, SeekSource.REMOTE);
        case "seekForward":
          return seekRelative(command.intervalSeconds, SeekSource.REMOTE);
        case "seekTo":
          return seekTo(command.positionSeconds, SeekSource.REMOTE);
      }
    }),
  );
}
