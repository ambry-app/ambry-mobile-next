import { useCallback, useRef } from "react";
import { FlatList, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";
import { useShallow } from "zustand/shallow";

import { Button } from "@/components";
import * as schema from "@/db/schema";
import { seekTo } from "@/services/seek-service";
import { SeekSource, usePlayerUIState } from "@/stores/player-ui-state";
import { Colors } from "@/styles";
import { secondsDisplay } from "@/utils";
import { useBackHandler } from "@/utils/hooks";

const chapterRowHeight = 54;

export default function ChapterSelectRoute() {
  useBackHandler(() => {
    router.back();
    return true;
  });
  const { bottom } = useSafeAreaInsets();

  const { chapters, currentChapter } = usePlayerUIState(
    useShallow(({ chapters, currentChapter }) => ({
      chapters,
      currentChapter,
    })),
  );

  const flatlistRef = useRef<FlatList>(null);

  const scrollToChapter = useCallback(() => {
    if (!currentChapter) return;

    const index = chapters.findIndex(
      (chapter) => chapter.id === currentChapter.id,
    );

    flatlistRef.current?.scrollToIndex({
      index,
      animated: false,
      viewPosition: 0.5,
    });
  }, [chapters, currentChapter]);

  if (!currentChapter) return null;

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatlistRef}
        onLayout={scrollToChapter}
        style={styles.chapterList}
        data={chapters}
        keyExtractor={(item) => item.id}
        getItemLayout={(_, index) => ({
          length: chapterRowHeight,
          offset: chapterRowHeight * index,
          index,
        })}
        renderItem={({ item }) => (
          <Chapter chapter={item} currentChapterId={currentChapter.id} />
        )}
        ListFooterComponent={<View style={{ height: bottom }} />}
      />
    </View>
  );
}

type ChapterProps = {
  chapter: schema.Chapter;
  currentChapterId: string;
};

function Chapter({ chapter, currentChapterId }: ChapterProps) {
  return (
    <View style={styles.chapterRowContainer}>
      <Button
        size={24}
        style={styles.chapterButton}
        onPress={() => {
          router.back();
          setTimeout(() => seekTo(chapter.startTime, SeekSource.CHAPTER), 50);
        }}
      >
        <View style={styles.chapterRow}>
          <View style={styles.iconContainer}>
            {chapter.id === currentChapterId && (
              <FontAwesome6
                name="volume-high"
                size={16}
                color={Colors.zinc[100]}
              />
            )}
          </View>
          <Text numberOfLines={1} style={styles.chapterTitle}>
            {chapter.title}
          </Text>
          <Text numberOfLines={1} style={styles.chapterTime}>
            {secondsDisplay(chapter.startTime)}
          </Text>
        </View>
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Platform.OS === "android" ? Colors.zinc[950] : undefined,
    height: "100%",
  },
  chapterList: {
    paddingHorizontal: 16,
  },
  chapterRowContainer: {
    height: chapterRowHeight,
  },
  chapterButton: {
    paddingVertical: 16,
    borderColor: Colors.zinc[600],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chapterRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  },
  chapterTitle: {
    flex: 1,
    fontSize: 16,
    color: Colors.zinc[100],
  },
  chapterTime: {
    color: Colors.zinc[400],
  },
  iconContainer: {
    height: 16,
    width: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
});
