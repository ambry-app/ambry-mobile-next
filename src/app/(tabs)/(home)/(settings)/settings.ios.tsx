// iOS version - uses SwiftUI
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking } from "react-native";
import {
  Button,
  Host,
  LabeledContent,
  List,
  Section,
  Switch,
  Text,
} from "@expo/ui/swift-ui";
import { foregroundStyle, listStyle } from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";

import { signOut } from "@/services/auth-service";
import { unloadPlayer } from "@/services/playback-controls";
import { setSleepTimerMotionDetectionEnabled } from "@/services/sleep-timer-service";
import { sync } from "@/services/sync-service";
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

  // Local state for the toggle to handle async permission flow
  // This ensures the toggle updates correctly even when the Switch component
  // doesn't properly sync with value prop changes during async operations
  const [motionToggle, setMotionToggle] = useState(
    sleepTimerMotionDetectionEnabled,
  );

  // Sync local state with store when store changes (e.g., on initial load)
  useEffect(() => {
    setMotionToggle(sleepTimerMotionDetectionEnabled);
  }, [sleepTimerMotionDetectionEnabled]);

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

      // Optimistically update local state
      setMotionToggle(enabled);

      const result = await setSleepTimerMotionDetectionEnabled(
        session,
        enabled,
      );

      // If failed, reset local state
      if (!result.success) {
        setMotionToggle(false);

        // If permission was permanently denied, show alert to guide user to Settings
        if (result.permissionDenied) {
          Alert.alert(
            "Permission Required",
            "Motion detection requires access to Motion & Fitness data. Please enable it in Settings.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Open Settings",
                onPress: () => Linking.openSettings(),
              },
            ],
          );
        }
      }
    },
    [session],
  );

  const handleForceFullSync = useCallback(async () => {
    if (!session) return;
    await sync(session, { fullEventResync: true });
    Alert.alert("Sync Complete", "Full event sync has been completed.");
  }, [session]);

  if (!session) return null;

  const sleepTimerDisplay = sleepTimerEnabled
    ? `${Math.floor(sleepTimer / 60)} min`
    : "Off";

  return (
    <Host style={{ flex: 1 }}>
      <List modifiers={[listStyle("insetGrouped")]}>
        <Section title="ACCOUNT">
          <Text modifiers={[foregroundStyle(Colors.zinc[400])]}>
            {session.email}
          </Text>
          <Text modifiers={[foregroundStyle(Colors.zinc[500])]}>
            {session.url}
          </Text>
          <Button label="Sign Out" role="destructive" onPress={handleSignOut} />
        </Section>

        <Section title="PLAYBACK">
          <LabeledContent label="Default Speed">
            <Button
              label={`${formatPlaybackRate(preferredPlaybackRate)}×`}
              onPress={openPlaybackRateSettings}
            />
          </LabeledContent>
          <LabeledContent label="Sleep Timer">
            <Button
              label={sleepTimerDisplay}
              onPress={openSleepTimerSettings}
            />
          </LabeledContent>
          <Switch
            label="Motion Detection"
            value={motionToggle}
            onValueChange={handleMotionDetectionToggle}
            color={Colors.lime[500]}
          />
        </Section>

        <Section title="DEBUG">
          <Switch
            label="Debug Mode"
            value={debugModeEnabled}
            onValueChange={setDebugModeEnabled}
            color={Colors.lime[500]}
          />
          <Button label="Force Full Sync" onPress={handleForceFullSync} />
        </Section>
      </List>
    </Host>
  );
}
