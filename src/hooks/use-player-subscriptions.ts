import { useEffect } from "react";
import { AppStateStatus, EmitterSubscription } from "react-native";

import * as Player from "@/services/trackplayer-wrapper";
import { Event } from "@/services/trackplayer-wrapper";
import { setProgress, usePlayerUIState } from "@/stores/player-ui-state";

const POSITION_POLL_INTERVAL = 1000; // 1 second for position/duration

/**
 * Subscribes to TrackPlayer events and polls for position to keep the UI
 * state in sync with the native player.
 */
export function usePlayerSubscriptions(appState: AppStateStatus) {
  const playerLoaded = usePlayerUIState((state) => !!state.loadedPlaythrough);

  useEffect(() => {
    const subscriptions: EmitterSubscription[] = [];
    let positionIntervalId: NodeJS.Timeout | null = null;

    const pollPosition = async () => {
      try {
        const progress = await Player.getProgress();
        setProgress(progress.position, progress.duration);
      } catch (error) {
        // Can happen if player is reset while polling
        console.warn("[PlayerSubscriptions] Error polling position:", error);
      }
    };

    const onPlaybackQueueEnded = () => {
      const { duration } = usePlayerUIState.getState();
      console.debug(
        "[PlayerSubscriptions] PlaybackQueueEnded at position",
        duration,
      );
      setProgress(duration, duration);
    };

    if (appState === "active" && playerLoaded) {
      console.debug("[PlayerSubscriptions] Subscribing to player events");
      pollPosition(); // Initial poll

      // Poll position/duration every 1 second
      positionIntervalId = setInterval(pollPosition, POSITION_POLL_INTERVAL);

      subscriptions.push(
        Player.addEventListener(Event.PlaybackQueueEnded, onPlaybackQueueEnded),
      );
    }

    return () => {
      if (positionIntervalId) clearInterval(positionIntervalId);
      if (subscriptions.length !== 0) {
        console.debug("[PlayerSubscriptions] Unsubscribing from player events");
        subscriptions.forEach((sub) => sub.remove());
      }
    };
  }, [appState, playerLoaded]);
}
