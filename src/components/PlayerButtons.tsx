import { StyleSheet, View } from "react-native";
import colors from "tailwindcss/colors";
import IconButton from "./IconButton";

export default function PlayerButtons() {
  return (
    <View style={styles.container}>
      <IconButton
        onPress={() => {
          console.log("TODO: back 1 min");
        }}
        size={24}
        icon="backward"
        color={colors.zinc[100]}
      />
      <IconButton
        onPress={() => {
          console.log("TODO: back 10 sec");
        }}
        size={32}
        icon="arrow-rotate-left"
        color={colors.zinc[100]}
      />
      <IconButton
        onPress={() => {
          console.log("TODO: play/pause");
        }}
        size={48}
        icon="play"
        color={colors.zinc[100]}
      />
      <IconButton
        onPress={() => {
          console.log("TODO: forward 10 sec");
        }}
        size={32}
        icon="arrow-rotate-right"
        color={colors.zinc[100]}
      />
      <IconButton
        onPress={() => {
          console.log("TODO: forward 1 min");
        }}
        size={24}
        icon="forward"
        color={colors.zinc[100]}
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
    paddingHorizontal: 32,
  },
});
