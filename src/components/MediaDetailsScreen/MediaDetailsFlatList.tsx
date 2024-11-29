import { useMediaIds } from "@/src/db/library";
import { Session } from "@/src/stores/session";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import ActionBar from "./ActionBar";
import AuthorsAndNarrators from "./AuthorsAndNarrators";
import Header from "./Header";
import MediaDescription from "./MediaDescription";
import OtherBooksByAuthor from "./OtherBooksByAuthor";
import OtherBooksInSeries from "./OtherBooksInSeries";
import OtherEditions from "./OtherEditions";
import OtherMediaByNarrator from "./OtherMediaByNarrator";

type HeaderSection = {
  id: string;
  type: "header";
  mediaId: string;
};

type ActionBarSection = {
  id: string;
  type: "actionBar";
  mediaId: string;
};

type MediaDescriptionSection = {
  id: string;
  type: "mediaDescription";
  mediaId: string;
};

type AuthorsAndNarratorsSection = {
  id: string;
  type: "authorsAndNarrators";
  mediaId: string;
};

type OtherEditionsSection = {
  id: string;
  type: "otherEditions";
  bookId: string;
  withoutMediaId: string;
};

type OtherBooksInSeriesSection = {
  id: string;
  type: "otherBooksInSeries";
  seriesId: string;
};

type OtherBooksByAuthorSection = {
  id: string;
  type: "otherBooksByAuthor";
  authorId: string;
  withoutBookId: string;
  withoutSeriesIds: string[];
};

type OtherMediaByNarratorSection = {
  id: string;
  type: "otherMediaByNarrator";
  narratorId: string;
  withoutMediaId: string;
  withoutSeriesIds: string[];
  withoutAuthorIds: string[];
};

type Section =
  | HeaderSection
  | ActionBarSection
  | MediaDescriptionSection
  | AuthorsAndNarratorsSection
  | OtherEditionsSection
  | OtherBooksInSeriesSection
  | OtherBooksByAuthorSection
  | OtherMediaByNarratorSection;

function useSections(mediaId: string, session: Session) {
  const { ids, opacity } = useMediaIds(session, mediaId);

  const [sections, setSections] = useState<Section[] | undefined>();

  useEffect(() => {
    if (!ids) return;

    const sections: Section[] = [
      { id: `header-${mediaId}`, type: "header", mediaId },
      { id: `actions-${mediaId}`, type: "actionBar", mediaId },
      {
        id: `description-${mediaId}`,
        type: "mediaDescription",
        mediaId,
      },
      {
        id: `authors-narrators-${mediaId}`,
        type: "authorsAndNarrators",
        mediaId,
      },
      {
        id: `editions-${mediaId}`,
        type: "otherEditions",
        bookId: ids.bookId,
        withoutMediaId: mediaId,
      },
      ...ids.seriesIds.map(
        (seriesId): OtherBooksInSeriesSection => ({
          id: `books-in-series-${seriesId}`,
          type: "otherBooksInSeries",
          seriesId,
        }),
      ),
      ...ids.authorIds.map(
        (authorId): OtherBooksByAuthorSection => ({
          id: `other-books-${authorId}`,
          type: "otherBooksByAuthor",
          authorId,
          withoutBookId: ids.bookId,
          withoutSeriesIds: ids.seriesIds,
        }),
      ),
      ...ids.narratorIds.map(
        (narratorId): OtherMediaByNarratorSection => ({
          id: `other-media-${narratorId}`,
          type: "otherMediaByNarrator",
          narratorId,
          withoutMediaId: mediaId,
          withoutSeriesIds: ids.seriesIds,
          withoutAuthorIds: ids.authorIds,
        }),
      ),
    ];
    setSections(sections);
  }, [ids, mediaId, session]);

  return { sections, opacity };
}

type MediaDetailsFlatListProps = {
  session: Session;
  mediaId: string;
};

export default function MediaDetailsFlatList({
  session,
  mediaId,
}: MediaDetailsFlatListProps) {
  const { sections, opacity } = useSections(mediaId, session);

  if (!sections) return null;

  return (
    <Animated.FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { opacity }]}
      data={sections}
      keyExtractor={(item) => item.id}
      initialNumToRender={2}
      ListHeaderComponent={<View style={styles.listSpacer} />}
      ListFooterComponent={<View style={styles.listSpacer} />}
      renderItem={({ item }) => {
        switch (item.type) {
          case "header":
            return <Header mediaId={item.mediaId} session={session} />;
          case "actionBar":
            return <ActionBar mediaId={item.mediaId} session={session} />;
          case "mediaDescription":
            return (
              <MediaDescription mediaId={item.mediaId} session={session} />
            );
          case "authorsAndNarrators":
            return (
              <AuthorsAndNarrators mediaId={item.mediaId} session={session} />
            );
          case "otherEditions":
            return (
              <OtherEditions
                bookId={item.bookId}
                withoutMediaId={item.withoutMediaId}
                session={session}
              />
            );
          case "otherBooksInSeries":
            return (
              <OtherBooksInSeries seriesId={item.seriesId} session={session} />
            );
          case "otherBooksByAuthor":
            return (
              <OtherBooksByAuthor
                authorId={item.authorId}
                session={session}
                withoutBookId={item.withoutBookId}
                withoutSeriesIds={item.withoutSeriesIds}
              />
            );
          case "otherMediaByNarrator":
            return (
              <OtherMediaByNarrator
                narratorId={item.narratorId}
                session={session}
                withoutMediaId={item.withoutMediaId}
                withoutSeriesIds={item.withoutSeriesIds}
                withoutAuthorIds={item.withoutAuthorIds}
              />
            );
          default:
            // can't happen
            console.error("unknown section type:", item);
            return null;
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  listSpacer: {
    height: 16,
  },
});
