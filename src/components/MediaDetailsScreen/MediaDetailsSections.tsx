import { useMediaIds } from "@/src/hooks/library";
import { usePullToRefresh } from "@/src/hooks/use-pull-to-refresh";
import { Session } from "@/src/stores/session";
import { useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { ActionBar } from "./ActionBar";
import { AuthorsAndNarrators } from "./AuthorsAndNarrators";
import { Header } from "./Header";
import { MediaDescription } from "./MediaDescription";
import { OtherBooksByAuthor } from "./OtherBooksByAuthor";
import { BooksInSeries } from "./BooksInSeries";
import { OtherEditions } from "./OtherEditions";
import { OtherMediaByNarrator } from "./OtherMediaByNarrator";

type MediaDetailsSectionsProps = {
  session: Session;
  mediaId: string;
};

export function MediaDetailsSections(props: MediaDetailsSectionsProps) {
  const { session, mediaId } = props;
  const { ids } = useMediaIds(session, mediaId);
  const [showRest, setShowRest] = useState(false);
  const { refreshing, onRefresh } = usePullToRefresh(session);

  useEffect(() => {
    // Show the rest of the sections after a short delay
    const timeout = setTimeout(() => setShowRest(true), 100);
    return () => clearTimeout(timeout);
  }, []);

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
      {showRest && (
        <>
          <AuthorsAndNarrators mediaId={mediaId} session={session} />
          <OtherEditions
            bookId={ids.bookId}
            withoutMediaId={mediaId}
            session={session}
          />
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
          {/* {ids.narratorIds.map((narratorId) => (
            <OtherMediaByNarrator
              key={`other-media-${narratorId}`}
              narratorId={narratorId}
              session={session}
              withoutMediaId={mediaId}
              withoutSeriesIds={ids.seriesIds}
              withoutAuthorIds={ids.authorIds}
            />
          ))} */}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
});
