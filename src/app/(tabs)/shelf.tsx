import { StyleSheet, Text, View } from "react-native";

export default function ShelfScreen() {
  return (
    <View style={styles.container}>
      <Text className="text-zinc-100">Tab Shelf</Text>
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
