import { RefreshControl, ScrollView, StyleSheet } from "react-native";

import { FadeInOnMount } from "@/components/FadeInOnMount";
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
import { Session } from "@/types/session";

type MediaScreenProps = {
  session: Session;
  mediaId: string;
};

export function MediaScreen(props: MediaScreenProps) {
  const { session, mediaId } = props;
  const { refreshing, onRefresh } = usePullToRefresh(session);
  const media = useLibraryData(() => getMediaHeaderInfo(session, mediaId));

  if (!media) return null;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <FadeInOnMount>
        <Header media={media} />
        <ActionBar media={media} session={session} />
        <PlaythroughHistory
          session={session}
          mediaId={media.id}
          mediaDuration={media.duration ? parseFloat(media.duration) : null}
        />
        <MediaDescription media={media} />
      </FadeInOnMount>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
});
