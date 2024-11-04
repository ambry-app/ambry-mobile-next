import {
  skipToBeginningOfChapter,
  skipToEndOfChapter,
  usePlayer,
} from "@/src/stores/player";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import colors from "tailwindcss/colors";
import Button from "./Button";
import IconButton from "./IconButton";

export default function PlayerChapterControls() {
  const chapterState = usePlayer((state) => state.chapterState);

  if (!chapterState) return null;

  return (
    <>
      <View style={styles.container}>
        <IconButton
          icon="backward-step"
          size={24}
          style={{ padding: 8 }}
          color="white"
          onPress={skipToBeginningOfChapter}
        />
        <Button
          style={{ flex: 1 }}
          size={24}
          onPress={() => router.navigate("/chapter-select")}
        >
          <Text style={styles.chapterText} numberOfLines={1}>
            {chapterState.currentChapter.title}
          </Text>
        </Button>
        <IconButton
          icon="forward-step"
          size={24}
          style={{ padding: 8 }}
          color="white"
          onPress={skipToEndOfChapter}
        />
      </View>
      {/* maybe this is a bit much... */}
      {/* <View style={styles.timeDisplayContainer}>
        <Text style={styles.timeDisplayText} numberOfLines={1}>
          {secondsDisplay(position - chapterState.currentChapter.startTime)}
        </Text>
        <Text style={styles.timeDisplayText} numberOfLines={1}>
          -
          {secondsDisplay(
            ((chapterState.currentChapter.endTime || duration) - position) /
              playbackRate,
          )}
        </Text>
      </View> */}
    </>
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
  timeDisplayContainer: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: -8,
    marginHorizontal: -2,
  },
  timeDisplayText: {
    fontSize: 12,
    color: colors.zinc[600],
  },
});
