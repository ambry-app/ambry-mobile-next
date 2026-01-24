import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useShallow } from "zustand/shallow";

import { IconButton } from "@/components/IconButton";
import { setSleepTimerEnabled } from "@/services/sleep-timer-service";
import { useSession } from "@/stores/session";
import {
  selectIsMotionPausingTimer,
  useSleepTimer,
} from "@/stores/sleep-timer";
import { useTrackPlayer } from "@/stores/track-player";
import { Colors, interactive } from "@/styles/colors";
import { formatPlaybackRate } from "@/utils/rate";
import { secondsDisplayMinutesOnly } from "@/utils/time";

export function PlayerSettingButtons() {
  return (
    <View style={styles.container}>
      <SleepTimerButton />
      <PlaybackRateButton />
    </View>
  );
}

function SleepTimerButton() {
  const session = useSession((state) => state.session);
  const sleepTimerEnabled = useSleepTimer((state) => state.sleepTimerEnabled);
  const isMotionPausingTimer = useSleepTimer(selectIsMotionPausingTimer);

  return (
    <View style={styles.sleepTimerContainer}>
      <IconButton
        icon="stopwatch"
        size={16}
        color={Colors.zinc[100]}
        style={styles.button}
        onPress={() => {
          router.navigate("/sleep-timer");
        }}
        onLongPress={() => {
          if (session) setSleepTimerEnabled(session, !sleepTimerEnabled);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      >
        <SleepTimerLabel />
      </IconButton>
      {isMotionPausingTimer && (
        <FontAwesome6
          name="person-walking"
          size={14}
          color={Colors.zinc[100]}
        />
      )}
    </View>
  );
}

function SleepTimerLabel() {
  const { sleepTimer, sleepTimerEnabled, sleepTimerTriggerTime } =
    useSleepTimer(
      useShallow(
        ({ sleepTimer, sleepTimerEnabled, sleepTimerTriggerTime }) => ({
          sleepTimer,
          sleepTimerEnabled,
          sleepTimerTriggerTime,
        }),
      ),
    );
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!sleepTimerEnabled || sleepTimerTriggerTime === null) {
      setCountdown(null);
      return;
    }

    // Update countdown immediately
    const updateCountdown = () => {
      const newCountdown = (sleepTimerTriggerTime - Date.now()) / 1000;
      setCountdown(Math.ceil(Math.max(0, newCountdown)));
    };

    updateCountdown();

    // Then update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerEnabled, sleepTimerTriggerTime]);

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
  const playbackRate = useTrackPlayer((state) => state.playbackRate);

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
  sleepTimerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  button: {
    backgroundColor: interactive.fill + "80",
    borderRadius: 999,
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 4,
  },
  sleepTimerText: {
    color: Colors.zinc[100],
  },
});
