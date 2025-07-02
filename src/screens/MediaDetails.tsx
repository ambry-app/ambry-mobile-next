import { Delay } from "@/src/components";
import {
  ActionBar,
  AuthorsAndNarrators,
  BooksInSeries,
  Header,
  MediaDescription,
  OtherBooksByAuthor,
  OtherEditions,
  OtherMediaByNarrator,
} from "@/src/components/media-details";
import { useMediaIds } from "@/src/hooks/library";
import { usePullToRefresh } from "@/src/hooks/use-pull-to-refresh";
import { Session } from "@/src/stores/session";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";

type MediaDetailsProps = {
  session: Session;
  mediaId: string;
};

export function MediaDetails(props: MediaDetailsProps) {
  const { session, mediaId } = props;
  const { ids } = useMediaIds(session, mediaId);

  const { refreshing, onRefresh } = usePullToRefresh(session);

  if (!ids) return null;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Header mediaId={mediaId} session={session} />
      <ActionBar mediaId={mediaId} session={session} />
      <MediaDescription mediaId={mediaId} session={session} />
      <Delay delay={550}>
        <AuthorsAndNarrators mediaId={mediaId} session={session} />
        <OtherEditions
          bookId={ids.bookId}
          withoutMediaId={ids.mediaId}
          session={session}
        />
        <Delay delay={100}>
          {ids.seriesIds.map((seriesId) => (
            <BooksInSeries
              key={`books-in-series-${seriesId}`}
              seriesId={seriesId}
              session={session}
            />
          ))}
          {ids.authorIds.map((authorId) => (
            <OtherBooksByAuthor
              key={`other-books-${authorId}`}
              authorId={authorId}
              session={session}
              withoutBookId={ids.bookId}
              withoutSeriesIds={ids.seriesIds}
            />
          ))}
          {ids.narratorIds.map((narratorId) => (
            <OtherMediaByNarrator
              key={`other-media-${narratorId}`}
              narratorId={narratorId}
              session={session}
              withoutMediaId={mediaId}
              withoutSeriesIds={ids.seriesIds}
              withoutAuthorIds={ids.authorIds}
            />
          ))}
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
