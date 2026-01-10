// iOS version - uses SwiftUI
import { useCallback } from "react";
import { Button, Host, List, Section, Switch, Text } from "@expo/ui/swift-ui";
import { router } from "expo-router";

import { signOut } from "@/services/auth-service";
import { unloadPlayer } from "@/services/playback-controls";
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

  if (!session) return null;

  const sleepTimerDisplay = sleepTimerEnabled
    ? `${Math.floor(sleepTimer / 60)} min`
    : "Off";

  return (
    <Host style={{ flex: 1 }}>
      <List listStyle="insetGrouped">
        <Section title="ACCOUNT">
          <Text color={Colors.zinc[400]}>{session.email}</Text>
          <Text color={Colors.zinc[500]}>{session.url}</Text>
          <Button role="destructive" onPress={handleSignOut}>
            Sign Out
          </Button>
        </Section>

        <Section title="PLAYBACK">
          <Button onPress={openPlaybackRateSettings}>
            Default Speed: {formatPlaybackRate(preferredPlaybackRate)}×
          </Button>
          <Button onPress={openSleepTimerSettings}>
            Sleep Timer: {sleepTimerDisplay}
          </Button>
        </Section>

        <Section title="DEBUG">
          <Switch
            label="Debug Mode"
            value={debugModeEnabled}
            onValueChange={setDebugModeEnabled}
            color={Colors.lime[500]}
          />
        </Section>
      </List>
    </Host>
  );
}
