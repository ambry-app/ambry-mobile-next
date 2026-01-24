import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { useShallow } from "zustand/shallow";

import { Button } from "@/components/Button";
import { IconButton } from "@/components/IconButton";
import {
  setSleepTimerEnabled,
  setSleepTimerMotionDetectionEnabled,
  setSleepTimerTime,
} from "@/services/sleep-timer-service";
import { useDebug } from "@/stores/debug";
import { useSession } from "@/stores/session";
import { useSleepTimer } from "@/stores/sleep-timer";
import { Colors, decorative, interactive, surface } from "@/styles/colors";

function formatSeconds(seconds: number) {
  return Math.round(seconds / 60);
}

export default function SleepTimerRoute() {
  const { bottom } = useSafeAreaInsets();
  const session = useSession((state) => state.session);
  const debugModeEnabled = useDebug((state) => state.debugModeEnabled);

  const { sleepTimer, sleepTimerEnabled, sleepTimerMotionDetectionEnabled } =
    useSleepTimer(
      useShallow(
        ({
          sleepTimer,
          sleepTimerEnabled,
          sleepTimerMotionDetectionEnabled,
        }) => ({
          sleepTimer,
          sleepTimerEnabled,
          sleepTimerMotionDetectionEnabled,
        }),
      ),
    );

  const [displaySleepTimerSeconds, setDisplaySleepTimerSeconds] =
    useState(sleepTimer);
  const [displayMotionDetectionEnabled, setDisplayMotionDetectionEnabled] =
    useState(sleepTimerMotionDetectionEnabled);

  useEffect(() => {
    setDisplaySleepTimerSeconds(sleepTimer);
  }, [sleepTimer]);

  useEffect(() => {
    setDisplayMotionDetectionEnabled(sleepTimerMotionDetectionEnabled);
  }, [sleepTimerMotionDetectionEnabled]);

  const setSleepTimerSecondsAndDisplay = useCallback(
    (value: number) => {
      setDisplaySleepTimerSeconds(value);
      if (session) setSleepTimerTime(session, value);
    },
    [session],
  );

  const handleMotionDetectionToggle = useCallback(
    async (value: boolean) => {
      if (!session) return;

      // Optimistic update
      setDisplayMotionDetectionEnabled(value);

      const result = await setSleepTimerMotionDetectionEnabled(session, value);

      if (!result.success) {
        // Revert optimistic update
        setDisplayMotionDetectionEnabled(!value);

        if (result.permissionDenied) {
          Alert.alert(
            "Permission Required",
            "Motion detection requires Motion & Fitness permission. Please enable it in Settings.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ],
          );
        }
      }
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
        <View style={styles.toggleRow}>
          <Text style={styles.sleepTimerEnabledText}>
            Sleep Timer is {sleepTimerEnabled ? "enabled" : "disabled"}
          </Text>
          <Switch
            trackColor={{ false: Colors.zinc[400], true: Colors.lime[500] }}
            thumbColor={Colors.zinc[100]}
            value={sleepTimerEnabled}
            onValueChange={(value) => {
              setSleepTimerEnabled(session, value);
            }}
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleLabelContainer}>
            <Text style={styles.sleepTimerEnabledText}>Motion Detection</Text>
            <Text style={styles.toggleDescription}>
              Pauses timer while you're moving
            </Text>
          </View>
          <Switch
            trackColor={{ false: Colors.zinc[400], true: Colors.lime[500] }}
            thumbColor={Colors.zinc[100]}
            value={displayMotionDetectionEnabled}
            onValueChange={handleMotionDetectionToggle}
          />
        </View>

        {debugModeEnabled && <MotionDebugInfo />}
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

function MotionDebugInfo() {
  const { isStationary, sleepTimerMotionDetectionEnabled } = useSleepTimer(
    useShallow(({ isStationary, sleepTimerMotionDetectionEnabled }) => ({
      isStationary,
      sleepTimerMotionDetectionEnabled,
    })),
  );

  const stationaryStatus =
    isStationary === null ? "Unknown" : isStationary ? "Stationary" : "Moving";

  return (
    <View style={styles.debugContainer}>
      <Text style={styles.debugTitle}>Motion Detection Debug</Text>
      <View style={styles.debugRow}>
        <Text style={styles.debugLabel}>Enabled:</Text>
        <Text style={styles.debugValue}>
          {sleepTimerMotionDetectionEnabled ? "Yes" : "No"}
        </Text>
      </View>
      <View style={styles.debugRow}>
        <Text style={styles.debugLabel}>Status:</Text>
        <Text
          style={[
            styles.debugValue,
            isStationary === false && styles.debugValueHighlight,
          ]}
        >
          {stationaryStatus}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  handle: {
    width: 40,
    height: 4,
    backgroundColor: decorative.handle,
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
    backgroundColor: interactive.fill,
    borderRadius: 999,
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  sleepTimerButtonActive: {
    backgroundColor: interactive.selected,
    color: Colors.black,
  },
  sleepTimerButtonActiveText: {
    color: Colors.black,
  },
  toggleRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  toggleDescription: {
    color: Colors.zinc[500],
    fontSize: 12,
    marginTop: 2,
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
    backgroundColor: interactive.fill,
    borderRadius: 999,
  },
  debugContainer: {
    backgroundColor: surface.elevated,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: decorative.divider,
  },
  debugTitle: {
    color: Colors.zinc[400],
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  debugRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  debugLabel: {
    color: Colors.zinc[500],
    fontSize: 12,
  },
  debugValue: {
    color: Colors.zinc[300],
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  debugValueHighlight: {
    color: Colors.lime[400],
  },
});
