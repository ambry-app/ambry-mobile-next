import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import colors from "tailwindcss/colors";
import Button from "./Button";
import IconButton from "./IconButton";

export default function PlayerChapterControls() {
  return (
    <View style={styles.container}>
      <IconButton
        icon="backward-step"
        size={24}
        style={{ padding: 8 }}
        color="white"
        onPress={() => {}}
      />
      <Button
        size={24}
        onPress={() => {
          router.navigate("/chapter-select");
        }}
      >
        <Text style={styles.chapterText} numberOfLines={1}>
          Chapter 1: This is not a real chapter
        </Text>
      </Button>
      <IconButton
        icon="forward-step"
        size={24}
        style={{ padding: 8 }}
        color="white"
        onPress={() => {}}
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
    marginHorizontal: -12, // or -20 if the below is used
    // backgroundColor: colors.zinc[800],
    // borderRadius: 999,
    // paddingHorizontal: 8,
  },
  chapterText: {
    color: colors.zinc[100],
  },
});
