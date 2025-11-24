import { Button, IconButton } from "@/src/components";
import { useSession } from "@/src/stores/session";
import {
  setSleepTimer,
  setSleepTimerState,
  useSleepTimer,
} from "@/src/stores/sleep-timer";
import { Colors } from "@/src/styles";
import Slider from "@react-native-community/slider";
import { useCallback, useEffect, useState } from "react";
import { Platform, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/shallow";

function formatSeconds(seconds: number) {
  return Math.round(seconds / 60);
}

export default function SleepTimerRoute() {
  const { bottom } = useSafeAreaInsets();
  const session = useSession((state) => state.session);

  const { sleepTimer, sleepTimerEnabled } = useSleepTimer(
    useShallow(({ sleepTimer, sleepTimerEnabled }) => ({
      sleepTimer,
      sleepTimerEnabled,
    })),
  );

  const [displaySleepTimerSeconds, setDisplaySleepTimerSeconds] =
    useState(sleepTimer);

  useEffect(() => {
    setDisplaySleepTimerSeconds(sleepTimer);
  }, [sleepTimer]);

  const setSleepTimerSecondsAndDisplay = useCallback(
    (value: number) => {
      setDisplaySleepTimerSeconds(value);
      if (session) setSleepTimer(session, value);
    },
    [session],
  );

  if (!session) return null;

  return (
    <View style={{ paddingBottom: Platform.OS === "android" ? bottom : 0 }}>
      {Platform.OS === "android" && <View style={styles.handle} />}
      <View style={styles.container}>
        <Text style={styles.title}>
          Sleep Timer: {formatSeconds(displaySleepTimerSeconds)} minutes
        </Text>

        <View style={styles.sliderRowContainer}>
          <IconButton
            icon="minus"
            color={Colors.zinc[100]}
            size={16}
            onPress={() => {
              const newSleepTimer = Math.max(300, sleepTimer - 300);
              setSleepTimerSecondsAndDisplay(newSleepTimer);
            }}
            style={styles.plusMinusButton}
          />
          <View style={styles.sliderContainer}>
            <Slider
              value={sleepTimer}
              minimumValue={300}
              maximumValue={5400}
              step={300}
              thumbTintColor={Colors.lime[400]}
              minimumTrackTintColor={Colors.zinc[400]}
              maximumTrackTintColor={Colors.zinc[400]}
              onValueChange={(value) => setDisplaySleepTimerSeconds(value)}
              onSlidingComplete={(value) =>
                setSleepTimerSecondsAndDisplay(value)
              }
            />
          </View>
          <IconButton
            icon="plus"
            color={Colors.zinc[100]}
            size={16}
            onPress={() => {
              const newSleepTimer = Math.min(5400, sleepTimer + 300);
              setSleepTimerSecondsAndDisplay(newSleepTimer);
            }}
            style={styles.plusMinusButton}
          />
        </View>

        <View style={styles.sleepTimerButtonRow}>
          <SleepTimerSecondsButton
            seconds={300}
            active={displaySleepTimerSeconds === 300}
            setSleepTimerSecondsAndDisplay={setSleepTimerSecondsAndDisplay}
          />
          <SleepTimerSecondsButton
            seconds={600}
            active={displaySleepTimerSeconds === 600}
            setSleepTimerSecondsAndDisplay={setSleepTimerSecondsAndDisplay}
          />
          <SleepTimerSecondsButton
            seconds={900}
            active={displaySleepTimerSeconds === 900}
            setSleepTimerSecondsAndDisplay={setSleepTimerSecondsAndDisplay}
          />
          <SleepTimerSecondsButton
            seconds={1800}
            active={displaySleepTimerSeconds === 1800}
            setSleepTimerSecondsAndDisplay={setSleepTimerSecondsAndDisplay}
          />
          <SleepTimerSecondsButton
            seconds={3600}
            active={displaySleepTimerSeconds === 3600}
            setSleepTimerSecondsAndDisplay={setSleepTimerSecondsAndDisplay}
          />
        </View>
        <View
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={styles.sleepTimerEnabledText}>
            Sleep Timer is {sleepTimerEnabled ? "enabled" : "disabled"}
          </Text>
          <Switch
            trackColor={{ false: Colors.zinc[400], true: Colors.lime[500] }}
            thumbColor={Colors.zinc[100]}
            value={sleepTimerEnabled}
            onValueChange={(value) => {
              setSleepTimerState(session, value);
            }}
          />
        </View>
      </View>
    </View>
  );
}

type SleepTimerSecondsButtonProps = {
  seconds: number;
  active: boolean;
  setSleepTimerSecondsAndDisplay: (value: number) => void;
};

function SleepTimerSecondsButton(props: SleepTimerSecondsButtonProps) {
  const { seconds, active, setSleepTimerSecondsAndDisplay } = props;

  return (
    <Button
      size={16}
      style={[styles.sleepTimerButton, active && styles.sleepTimerButtonActive]}
      onPress={() => setSleepTimerSecondsAndDisplay(seconds)}
    >
      <Text style={[styles.text, active && styles.sleepTimerButtonActiveText]}>
        {formatSeconds(seconds)}m
      </Text>
    </Button>
  );
}

const styles = StyleSheet.create({
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.zinc[500],
    borderRadius: 999,
    marginHorizontal: "auto",
    marginTop: 8,
  },
  container: {
    padding: 32,
    display: "flex",
    justifyContent: "center",
    gap: 24,
  },
  title: {
    color: Colors.zinc[100],
    fontSize: 18,
    textAlign: "center",
  },
  sleepTimerButtonRow: {
    display: "flex",
    flexDirection: "row",
    gap: 4,
  },
  sleepTimerButton: {
    backgroundColor: Colors.zinc[800],
    borderRadius: 999,
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  sleepTimerButtonActive: {
    backgroundColor: Colors.zinc[100],
    color: Colors.black,
  },
  sleepTimerButtonActiveText: {
    color: Colors.black,
  },
  sleepTimerEnabledText: {
    color: Colors.zinc[300],
    fontSize: 16,
  },
  text: {
    color: Colors.zinc[100],
    fontSize: 12,
  },
  sliderRowContainer: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  },
  sliderContainer: {
    flexGrow: 1,
  },
  plusMinusButton: {
    backgroundColor: Colors.zinc[800],
    borderRadius: 999,
  },
});
