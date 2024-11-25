import { setSleepTimerState, usePlayer } from "@/src/stores/player";
import { Colors } from "@/src/styles";
import { formatPlaybackRate } from "@/src/utils/rate";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { secondsDisplayMinutesOnly } from "../utils/time";
import IconButton from "./IconButton";

export default function PlayerSettingButtons() {
  const playbackRate = usePlayer((state) => state.playbackRate);
  const sleepTimer = usePlayer((state) => state.sleepTimer);
  const sleepTimerEnabled = usePlayer((state) => state.sleepTimerEnabled);
  const sleepTimerTriggerTime = usePlayer(
    (state) => state.sleepTimerTriggerTime,
  );
  const position = usePlayer((state) => state.position);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (sleepTimerEnabled && sleepTimerTriggerTime !== null) {
      const newCountdown = (sleepTimerTriggerTime - Date.now()) / 1000;
      setCountdown(Math.max(0, newCountdown));
    } else {
      setCountdown(null);
    }
  }, [position, sleepTimerEnabled, sleepTimerTriggerTime]);

  return (
    <View style={styles.container}>
      <IconButton
        icon="stopwatch"
        size={16}
        color={Colors.zinc[100]}
        style={styles.button}
        onPress={() => {
          router.navigate("/sleep-timer");
        }}
        onLongPress={() => {
          setSleepTimerState(!sleepTimerEnabled);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      >
        <SleepTimerLabel
          sleepTimer={sleepTimer}
          sleepTimerEnabled={sleepTimerEnabled}
          countdown={countdown}
        />
      </IconButton>
      <IconButton
        icon="gauge"
        size={16}
        color={Colors.zinc[100]}
        style={styles.button}
        onPress={() => {
          router.navigate("/playback-rate");
        }}
      >
        <Text style={styles.sleepTimerText}>
          {formatPlaybackRate(playbackRate)}×
        </Text>
      </IconButton>
    </View>
  );
}

type SleepTimerLabelProps = {
  sleepTimer: number;
  sleepTimerEnabled: boolean;
  countdown: number | null;
};

function SleepTimerLabel(props: SleepTimerLabelProps) {
  const { sleepTimer, sleepTimerEnabled, countdown } = props;

  if (!sleepTimerEnabled) return null;

  if (countdown === null)
    return (
      <Text style={styles.sleepTimerText}>
        {secondsDisplayMinutesOnly(sleepTimer)}
      </Text>
    );

  return (
    <Text style={styles.sleepTimerText}>
      {secondsDisplayMinutesOnly(countdown)}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: -20,
  },
  button: {
    backgroundColor: Colors.zinc[800],
    borderRadius: 999,
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 4,
  },
  sleepTimerText: {
    color: Colors.zinc[100],
  },
});
