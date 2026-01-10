import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Button } from "@/components/Button";
import { IconButton } from "@/components/IconButton";
import {
  skipToBeginningOfChapter,
  skipToEndOfChapter,
} from "@/services/chapter-service";
import { useTrackPlayer } from "@/stores/track-player";
import { Colors } from "@/styles/colors";

export function ChapterControls() {
  const currentChapter = useTrackPlayer((state) => state.currentChapter);

  if (!currentChapter) return null;

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
            {currentChapter.title}
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
    // backgroundColor: Colors.zinc[800],
    // borderRadius: 999,
    // paddingHorizontal: 8,
  },
  chapterText: {
    color: Colors.zinc[100],
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
    color: Colors.zinc[600],
  },
});
