import { Button, StyleSheet, Text, View } from "react-native";

import { tryUnloadPlayer } from "@/stores/player";
import { signOut, useSession } from "@/stores/session";
import { Colors } from "@/styles";

export default function SettingsRoute() {
  const session = useSession((state) => state.session);

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
});
