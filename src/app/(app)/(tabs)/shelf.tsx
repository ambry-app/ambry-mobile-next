import { Colors } from "@/src/styles";
import { StyleSheet, Text, View } from "react-native";

export default function ShelfScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Coming Soon:</Text>
      <Text style={styles.text}>
        Your in-progress audiobooks will show up here.
      </Text>
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
