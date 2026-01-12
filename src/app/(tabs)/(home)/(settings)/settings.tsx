// Android version (default) - uses Jetpack Compose Switch + React Native layout
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Switch } from "@expo/ui/jetpack-compose";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";

import { signOut } from "@/services/auth-service";
import { unloadPlayer } from "@/services/playback-controls";
import { setSleepTimerMotionDetectionEnabled } from "@/services/sleep-timer-service";
import { useDebug } from "@/stores/debug";
import { usePreferredPlaybackRate } from "@/stores/preferred-playback-rate";
import { useSession } from "@/stores/session";
import { useSleepTimer } from "@/stores/sleep-timer";
import { Colors } from "@/styles/colors";
import { formatPlaybackRate } from "@/utils/rate";

export default function SettingsRoute() {
  const session = useSession((state) => state.session);
  const { debugModeEnabled, setDebugModeEnabled } = useDebug();
  const preferredPlaybackRate = usePreferredPlaybackRate(
    (state) => state.preferredPlaybackRate,
  );
  const sleepTimer = useSleepTimer((state) => state.sleepTimer);
  const sleepTimerEnabled = useSleepTimer((state) => state.sleepTimerEnabled);
  const sleepTimerMotionDetectionEnabled = useSleepTimer(
    (state) => state.sleepTimerMotionDetectionEnabled,
  );

  const handleSignOut = useCallback(async () => {
    await unloadPlayer();
    await signOut();
  }, []);

  const openPlaybackRateSettings = useCallback(() => {
    router.push("/playback-rate?mode=settings");
  }, []);

  const openSleepTimerSettings = useCallback(() => {
    router.push("/sleep-timer");
  }, []);

  const handleMotionDetectionToggle = useCallback(
    (enabled: boolean) => {
      if (session) {
        setSleepTimerMotionDetectionEnabled(session, enabled);
      }
    },
    [session],
  );

  if (!session) return null;

  const sleepTimerDisplay = sleepTimerEnabled
    ? `${Math.floor(sleepTimer / 60)} min`
    : "Off";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{session.email}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Server</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {session.url}
            </Text>
          </View>
          <View style={styles.divider} />
          <Pressable style={styles.row} onPress={handleSignOut}>
            <Text style={styles.destructiveText}>Sign Out</Text>
          </Pressable>
        </View>
      </View>

      {/* Playback Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Playback</Text>
        <View style={styles.card}>
          <Pressable style={styles.row} onPress={openPlaybackRateSettings}>
            <Text style={styles.rowLabel}>Default Speed</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>
                {formatPlaybackRate(preferredPlaybackRate)}×
              </Text>
              <FontAwesome6
                name="chevron-right"
                size={14}
                color={Colors.zinc[500]}
              />
            </View>
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.row} onPress={openSleepTimerSettings}>
            <Text style={styles.rowLabel}>Sleep Timer</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{sleepTimerDisplay}</Text>
              <FontAwesome6
                name="chevron-right"
                size={14}
                color={Colors.zinc[500]}
              />
            </View>
          </Pressable>
          <View style={styles.divider} />
          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Text style={styles.rowLabel}>Motion Detection</Text>
              <Text style={styles.rowDescription}>
                Reset sleep timer when motion is detected
              </Text>
            </View>
            <Switch
              value={sleepTimerMotionDetectionEnabled}
              onValueChange={handleMotionDetectionToggle}
              color={Colors.lime[500]}
            />
          </View>
        </View>
      </View>

      {/* Debug Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Debug</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <Text style={styles.rowLabel}>Debug Mode</Text>
            <Switch
              value={debugModeEnabled}
              onValueChange={setDebugModeEnabled}
              color={Colors.lime[500]}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 24,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: Colors.zinc[400],
    fontSize: 13,
    fontWeight: "500",
    textTransform: "uppercase",
    marginLeft: 16,
  },
  card: {
    backgroundColor: Colors.zinc[900],
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowLabel: {
    color: Colors.zinc[100],
    fontSize: 16,
  },
  rowDescription: {
    color: Colors.zinc[500],
    fontSize: 13,
    marginTop: 2,
  },
  rowValue: {
    color: Colors.zinc[400],
    fontSize: 16,
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 12,
  },
  infoLabel: {
    color: Colors.zinc[400],
    fontSize: 16,
  },
  infoValue: {
    color: Colors.zinc[100],
    fontSize: 16,
    flex: 1,
    textAlign: "right",
    marginLeft: 16,
  },
  destructiveText: {
    color: Colors.red[400],
    fontSize: 16,
    textAlign: "center",
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.zinc[700],
    marginLeft: 16,
  },
});
