import Button from "@/src/components/Button";
import useBackHandler from "@/src/hooks/use.back.handler";
import {
  setSleepTimer,
  setSleepTimerState,
  usePlayer,
} from "@/src/stores/player";
import Slider from "@react-native-community/slider";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import colors from "tailwindcss/colors";

function formatSeconds(seconds: number) {
  return Math.round(seconds / 60);
}

export default function SleepTimerModal() {
  useBackHandler(() => {
    router.back();
    return true;
  });

  const { sleepTimer, sleepTimerEnabled } = usePlayer((state) => state);

  const [displaySleepTimerSeconds, setDisplaySleepTimerSeconds] =
    useState(sleepTimer);

  useEffect(() => {
    setDisplaySleepTimerSeconds(sleepTimer);
  }, [sleepTimer]);

  const setSleepTimerSecondsAndDisplay = useCallback((value: number) => {
    setDisplaySleepTimerSeconds(value);
    setSleepTimer(value);
  }, []);

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.title}>
          {formatSeconds(displaySleepTimerSeconds)}m
        </Text>
        <Slider
          value={sleepTimer}
          minimumValue={300}
          maximumValue={5400}
          step={300}
          thumbTintColor={colors.lime[400]}
          minimumTrackTintColor={colors.zinc[400]}
          maximumTrackTintColor={colors.zinc[400]}
          onValueChange={(value) => setDisplaySleepTimerSeconds(value)}
          onSlidingComplete={(value) => setSleepTimerSecondsAndDisplay(value)}
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
          trackColor={{ false: colors.zinc[400], true: colors.lime[500] }}
          thumbColor={colors.zinc[100]}
          value={sleepTimerEnabled}
          onValueChange={(value) => {
            setSleepTimerState(value);
          }}
        />
      </View>

      <Button
        size={32}
        onPress={() => router.back()}
        style={styles.closeButton}
      >
        <Text style={styles.closeButtonText}>Ok</Text>
      </Button>
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
  container: {
    padding: 32,
    backgroundColor: colors.zinc[950],
    height: "100%",
    display: "flex",
    justifyContent: "center",
    gap: 16,
  },
  title: {
    color: colors.zinc[100],
    margin: 16,
    fontSize: 18,
    textAlign: "center",
  },
  sleepTimerButtonRow: {
    display: "flex",
    flexDirection: "row",
    gap: 4,
  },
  sleepTimerButton: {
    backgroundColor: colors.zinc[800],
    borderRadius: 999,
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  sleepTimerButtonActive: {
    backgroundColor: colors.lime[400],
    color: colors.black,
  },
  sleepTimerButtonActiveText: {
    color: colors.black,
  },
  sleepTimerEnabledText: {
    color: colors.zinc[400],
    fontSize: 16,
  },
  text: {
    color: colors.zinc[100],
    fontSize: 12,
  },
  closeButton: {
    marginTop: 32,
  },
  closeButtonText: {
    color: colors.lime[400],
  },
});
