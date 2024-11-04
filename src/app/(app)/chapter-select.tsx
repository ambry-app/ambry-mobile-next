import Button from "@/src/components/Button";
import * as schema from "@/src/db/schema";
import useBackHandler from "@/src/hooks/use.back.handler";
import { seekTo, usePlayer } from "@/src/stores/player";
import { secondsDisplay } from "@/src/utils/time";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";
import { useCallback, useRef } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "tailwindcss/colors";

const chapterRowHeight = 54;

export default function ChapterSelectModal() {
  useBackHandler(() => {
    router.back();
    return true;
  });
  const { bottom } = useSafeAreaInsets();
  const chapterState = usePlayer((state) => state.chapterState);
  const flatlistRef = useRef<FlatList>(null);

  const scrollToChapter = useCallback(() => {
    if (!chapterState) return;

    const index = chapterState.chapters.findIndex(
      (chapter) => chapter.id === chapterState.currentChapter?.id,
    );

    flatlistRef.current?.scrollToIndex({
      index,
      animated: false,
      viewPosition: 0.5,
    });
  }, [chapterState]);

  if (!chapterState) return null;

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatlistRef}
        onLayout={scrollToChapter}
        style={styles.chapterList}
        data={chapterState.chapters}
        keyExtractor={(item) => item.id}
        getItemLayout={(_, index) => ({
          length: chapterRowHeight,
          offset: chapterRowHeight * index,
          index,
        })}
        renderItem={({ item }) => (
          <Chapter
            chapter={item}
            currentChapterId={chapterState.currentChapter.id}
          />
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
          setTimeout(() => seekTo(chapter.startTime), 50);
        }}
      >
        <View style={styles.chapterRow}>
          <View style={styles.iconContainer}>
            {chapter.id === currentChapterId && (
              <FontAwesome6
                name="volume-high"
                size={16}
                color={colors.zinc[100]}
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
    backgroundColor: colors.zinc[950],
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
    borderColor: colors.zinc[600],
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
    color: colors.zinc[100],
  },
  chapterTime: {
    color: colors.zinc[400],
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
