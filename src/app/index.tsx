import { Link } from "expo-router";
import { StyleSheet, View } from "react-native";

export default function PlayerScreen() {
  return (
    <View style={styles.container}>
      <Link className="text-zinc-100" href="/library">
        Go To Library
      </Link>
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
