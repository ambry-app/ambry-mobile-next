import { RefreshControl, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { BlurredImage } from "@/components/BlurredImage";
import { ScrollHandler } from "@/components/FadingHeader";
import { ActionBar } from "@/components/screens/media-screen/ActionBar";
import { BooksInSeries } from "@/components/screens/media-screen/BooksInSeries";
import { Header } from "@/components/screens/media-screen/Header";
import { MediaAuthorsAndNarrators } from "@/components/screens/media-screen/MediaAuthorsAndNarrators";
import { MediaDescription } from "@/components/screens/media-screen/MediaDescription";
import { OtherBooksByAuthors } from "@/components/screens/media-screen/OtherBooksByAuthors";
import { OtherEditions } from "@/components/screens/media-screen/OtherEditions";
import { OtherMediaByNarrators } from "@/components/screens/media-screen/OtherMediaByNarrators";
import { PlaythroughHistory } from "@/components/screens/media-screen/PlaythroughHistory";
import { getMediaHeaderInfo, useLibraryData } from "@/services/library-service";
import { usePullToRefresh } from "@/services/sync-service";
import { useScreen } from "@/stores/screen";
import { Session } from "@/types/session";

type MediaScreenProps = {
  session: Session;
  mediaId: string;
  scrollHandler: ScrollHandler;
};

export function MediaScreen(props: MediaScreenProps) {
  const { session, mediaId, scrollHandler } = props;
  const { refreshing, onRefresh } = usePullToRefresh(session);
  const media = useLibraryData(() => getMediaHeaderInfo(session, mediaId));
  const insets = useSafeAreaInsets();
  const { screenWidth, shortScreen } = useScreen();

  // Calculate blur height to reach to the bottom of the thumbnail
  // Thumbnail starts at insets.top + 8 (header paddingTop)
  // Thumbnail width is 60%/80% of screen width, and it's square
  const thumbnailWidth = screenWidth * (shortScreen ? 0.6 : 0.8);
  const thumbnailTop = insets.top + 8;
  const blurHeight = thumbnailTop + thumbnailWidth;

  if (!media) return null;

  return (
    <View style={styles.screenContainer}>
      <Animated.ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + 16 },
        ]}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Blurred background image with gradient fade - scrolls with content */}
        <View style={[styles.blurContainer, { height: blurHeight }]}>
          <BlurredImage
            thumbnails={media.thumbnails}
            downloadedThumbnails={media.download?.thumbnails}
            size="medium"
            style={styles.blurredImage}
            blurRadius={5}
          />
          <LinearGradient
            colors={["transparent", "black"]}
            style={styles.gradient}
          />
        </View>

        {/* Content overlaps the blur with negative margin */}
        <View style={{ marginTop: -blurHeight + insets.top }}>
          <Header media={media} />
          <ActionBar media={media} session={session} />
          <PlaythroughHistory
            session={session}
            mediaId={media.id}
            mediaDuration={media.duration ? parseFloat(media.duration) : null}
          />
          <MediaDescription media={media} />
          <MediaAuthorsAndNarrators media={media} session={session} />
          <OtherEditions media={media} session={session} />
          {media.book.series.length > 0 && (
            <BooksInSeries media={media} session={session} />
          )}
          {media.book.authors.length > 0 && (
            <OtherBooksByAuthors media={media} session={session} />
          )}
          {media.narrators.length > 0 && (
            <OtherMediaByNarrators media={media} session={session} />
          )}
        </View>
      </Animated.ScrollView>

      {/* <StatusBarOverlay height={insets.top} /> */}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: "black",
  },
  container: {},
  blurContainer: {
    overflow: "hidden",
  },
  blurredImage: {
    width: "100%",
    height: "100%",
    opacity: 0.6,
  },
  gradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
