import { useSessionStore } from "@/src/stores/session";
import { Button, StyleSheet, View } from "react-native";
import colors from "tailwindcss/colors";

export default function SettingsScreen() {
  const signOut = useSessionStore((state) => state.signOut);
  return (
    <View style={styles.container}>
      <Button title="Sign out" onPress={signOut} color={colors.lime[500]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
