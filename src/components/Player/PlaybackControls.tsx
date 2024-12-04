import { PlayButton, SeekButton } from "@/src/components";
import { Colors } from "@/src/styles";
import { StyleSheet, View } from "react-native";

export default function PlaybackControls() {
  return (
    <View style={styles.container}>
      <SeekButton
        amount={-60}
        icon="backward"
        size={24}
        color={Colors.zinc[100]}
      />
      <SeekButton
        amount={-10}
        icon="arrow-rotate-left"
        size={32}
        color={Colors.zinc[100]}
      />
      <PlayButton size={48} color={Colors.zinc[100]} style={{ padding: 16 }} />
      <SeekButton
        amount={10}
        icon="arrow-rotate-right"
        size={32}
        color={Colors.zinc[100]}
      />
      <SeekButton
        amount={60}
        icon="forward"
        size={24}
        color={Colors.zinc[100]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: -12,
  },
});
