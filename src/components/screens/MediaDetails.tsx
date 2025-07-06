import { Delay, FadeInOnMount } from "@/src/components";
import {
  ActionBar,
  AuthorsAndNarrators,
  BooksInSeries,
  Header,
  MediaDescription,
  OtherBooksByAuthors,
  OtherEditions,
  OtherMediaByNarrators,
} from "@/src/components/screens/media-details";
import { getMediaHeaderInfo } from "@/src/db/library";
import { useLibraryData } from "@/src/hooks/use-library-data";
import { usePullToRefresh } from "@/src/hooks/use-pull-to-refresh";
import { Session } from "@/src/stores/session";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";

type MediaDetailsProps = {
  session: Session;
  mediaId: string;
};

export function MediaDetails(props: MediaDetailsProps) {
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
        <MediaDescription media={media} />
      </FadeInOnMount>
      <Delay delay={100}>
        <AuthorsAndNarrators media={media} session={session} />
        <OtherEditions media={media} session={session} />
        <Delay delay={100}>
          {media.book.series.length > 0 && (
            <BooksInSeries media={media} session={session} />
          )}
          {media.book.authors.length > 0 && (
            <OtherBooksByAuthors media={media} session={session} />
          )}
          {media.narrators.length > 0 && (
            <OtherMediaByNarrators media={media} session={session} />
          )}
        </Delay>
      </Delay>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
});
