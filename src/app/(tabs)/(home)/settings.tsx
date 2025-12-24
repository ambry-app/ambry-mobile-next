import { Button, StyleSheet, Switch, Text, View } from "react-native";

import { useDebug } from "@/stores/debug";
import { tryUnloadPlayer } from "@/stores/player";
import { signOut, useSession } from "@/stores/session";
import { Colors } from "@/styles";

export default function SettingsRoute() {
  const session = useSession((state) => state.session);
  const { debugModeEnabled, setDebugModeEnabled } = useDebug();

  if (!session) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Coming Soon:</Text>
      <Text style={styles.text}>
        Settings, like your preferred playback speed, will be here.
      </Text>
      <Text style={styles.text}>You are signed in as: {session.email}</Text>
      <Text style={styles.text}>to server: {session.url}</Text>
      <Button
        title="Sign out"
        onPress={async function () {
          await tryUnloadPlayer();
          await signOut();
        }}
        color={Colors.lime[500]}
      />

      <View style={styles.debugSection}>
        <Text style={styles.debugLabel}>Debug Mode</Text>
        <Switch
          value={debugModeEnabled}
          onValueChange={setDebugModeEnabled}
          trackColor={{ false: Colors.zinc[700], true: Colors.lime[600] }}
          thumbColor={debugModeEnabled ? Colors.lime[300] : Colors.zinc[400]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  text: {
    color: Colors.zinc[100],
  },
  debugSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.zinc[700],
  },
  debugLabel: {
    color: Colors.zinc[400],
    fontSize: 14,
  },
});
