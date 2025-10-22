import { IconButton } from "@/src/components";
import { setSleepTimerState, usePlayer } from "@/src/stores/player";
import { Colors } from "@/src/styles";
import { formatPlaybackRate, secondsDisplayMinutesOnly } from "@/src/utils";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useShallow } from "zustand/shallow";

export function PlayerSettingButtons() {
  return (
    <View style={styles.container}>
      <SleepTimerButton />
      <PlaybackRateButton />
    </View>
  );
}

function SleepTimerButton() {
  const sleepTimerEnabled = usePlayer((state) => state.sleepTimerEnabled);

  return (
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
      <SleepTimerLabel />
    </IconButton>
  );
}

function SleepTimerLabel() {
  const { sleepTimer, sleepTimerEnabled, sleepTimerTriggerTime, position } =
    usePlayer(
      useShallow(
        ({
          sleepTimer,
          sleepTimerEnabled,
          sleepTimerTriggerTime,
          position,
        }) => ({
          sleepTimer,
          sleepTimerEnabled,
          sleepTimerTriggerTime,
          position,
        }),
      ),
    );
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (sleepTimerEnabled && sleepTimerTriggerTime !== null) {
      const newCountdown = (sleepTimerTriggerTime - Date.now()) / 1000;
      setCountdown(Math.max(0, newCountdown));
    } else {
      setCountdown(null);
    }
  }, [position, sleepTimerEnabled, sleepTimerTriggerTime]);

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

function PlaybackRateButton() {
  const playbackRate = usePlayer((s) => s.playbackRate);

  return (
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
    backgroundColor: Colors.zinc[800] + "80",
    borderRadius: 999,
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 4,
  },
  sleepTimerText: {
    color: Colors.zinc[100],
  },
});
