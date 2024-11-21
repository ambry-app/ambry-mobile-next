import { useSession } from "@/src/stores/session";
import { router } from "expo-router";
import { Button, StyleSheet, Text, View } from "react-native";
import colors from "tailwindcss/colors";

export default function SettingsScreen() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Coming Soon:</Text>
      <Text style={styles.text}>
        Settings, like your preferred playback speed, will be here.
      </Text>
      <Text style={styles.text}>You are signed in as: {session.email}</Text>
      <Button
        title="Sign out"
        onPress={() => router.replace("/sign-out")}
        color={colors.lime[500]}
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
    color: colors.zinc[100],
  },
});
