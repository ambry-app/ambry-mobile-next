// Android version (default) - uses Jetpack Compose Switch + React Native layout
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Host, Switch } from "@expo/ui/jetpack-compose";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router, Stack } from "expo-router";

import { Delay } from "@/components/Delay";
import {
  CollapsibleTabHeader,
  HEADER_CONTENT_HEIGHT,
  useCollapsibleHeader,
} from "@/components/FadingHeader";
import { signOut } from "@/services/auth-service";
import { unloadPlayer } from "@/services/playback-controls";
import { setSleepTimerMotionDetectionEnabled } from "@/services/sleep-timer-service";
import { sync } from "@/services/sync-service";
import { useDebug } from "@/stores/debug";
import { usePreferredPlaybackRate } from "@/stores/preferred-playback-rate";
import { useSession } from "@/stores/session";
import { useSleepTimer } from "@/stores/sleep-timer";
import { Colors, decorative, surface } from "@/styles/colors";
import { formatPlaybackRate } from "@/utils/rate";

export default function SettingsRoute() {
  const session = useSession((state) => state.session);
  const insets = useSafeAreaInsets();
  const {
    scrollHandler,
    headerTranslateY,
    borderTranslateY,
    borderOpacity,
    contentOpacity,
  } = useCollapsibleHeader({ statusBarHeight: insets.top });
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
    async (enabled: boolean) => {
      if (!session) return;
      // On Android, this always succeeds (accelerometer doesn't need permission)
      await setSleepTimerMotionDetectionEnabled(session, enabled);
    },
    [session],
  );

  const handleForceFullSync = useCallback(async () => {
    if (!session) return;
    await sync(session, { fullEventResync: true });
  }, [session]);

  if (!session) return null;

  const sleepTimerDisplay = sleepTimerEnabled
    ? `${Math.floor(sleepTimer / 60)} min`
    : "Off";

  return (
    <View style={styles.screenContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <Delay delay={10}>
        <Animated.ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingTop: insets.top + HEADER_CONTENT_HEIGHT + 16 },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
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
                <View style={styles.rowLabelContainer}>
                  <Text style={styles.rowLabel}>Default Speed</Text>
                  <Text style={styles.rowDescription}>
                    Starting speed for new audiobooks
                  </Text>
                </View>
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
                <View style={styles.rowLabelContainer}>
                  <Text style={styles.rowLabel}>Sleep Timer</Text>
                  <Text style={styles.rowDescription}>
                    Automatically pause playback after a set time
                  </Text>
                </View>
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
                <Host matchContents>
                  <Switch
                    value={sleepTimerMotionDetectionEnabled}
                    onValueChange={handleMotionDetectionToggle}
                    color={Colors.lime[500]}
                    variant="switch"
                  />
                </Host>
              </View>
            </View>
          </View>

          {/* Debug Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Debug</Text>
            <View style={styles.card}>
              <View style={styles.switchRow}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.rowLabel}>Debug Mode</Text>
                  <Text style={styles.rowDescription}>
                    Show extra info for troubleshooting
                  </Text>
                </View>
                <Host matchContents>
                  <Switch
                    value={debugModeEnabled}
                    onValueChange={setDebugModeEnabled}
                    color={Colors.lime[500]}
                    variant="switch"
                  />
                </Host>
              </View>
              <View style={styles.divider} />
              <Pressable style={styles.row} onPress={handleForceFullSync}>
                <Text style={styles.rowLabel}>Force Full Sync</Text>
              </Pressable>
            </View>
          </View>
        </Animated.ScrollView>
      </Delay>
      <CollapsibleTabHeader
        headerTranslateY={headerTranslateY}
        borderTranslateY={borderTranslateY}
        borderOpacity={borderOpacity}
        contentOpacity={contentOpacity}
        statusBarHeight={insets.top}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
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
    backgroundColor: surface.card,
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
  rowLabelContainer: {
    flex: 1,
    marginRight: 12,
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
    backgroundColor: decorative.divider,
  },
});
