import { useSession } from "@/src/stores/session";
import { useRouter } from "expo-router";
import { Button, StyleSheet, Text, View } from "react-native";
import colors from "tailwindcss/colors";

export default function SettingsScreen() {
  const signOut = useSession((state) => state.signOut);
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Coming Soon:</Text>
      <Text style={styles.text}>
        Settings, like your preferred playback speed, will be here.
      </Text>
      <Button
        title="Sign out"
        onPress={() => {
          signOut();
          router.navigate("/");
        }}
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
