import { SeriesBookTile } from "@/src/components";
import { useSeriesDetails } from "@/src/db/library";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import Footer from "./Footer";
import Header from "./Header";

export type AuthorOrNarrator = {
  id: string;
  name: string;
  type: "author" | "narrator" | "both" | "skip";
  person: {
    id: string;
    name: string;
    thumbnails: schema.Thumbnails | null;
  };
};

type SeriesDetailsFlatListProps = {
  seriesId: string;
  session: Session;
};

export default function SeriesDetailsFlatList({
  seriesId,
  session,
}: SeriesDetailsFlatListProps) {
  const { series, opacity } = useSeriesDetails(session, seriesId);

  if (!series) return null;

  const seriesBooks = series.seriesBooks.flatMap((sb) => {
    if (sb.book.media.length === 0) return [];
    return [sb];
  });

  const { authors, narrators } = seriesBooks.reduce(
    (acc, seriesBook) => {
      seriesBook.book.bookAuthors.forEach((bookAuthor) => {
        if (!acc.authorsSeen.has(bookAuthor.author.id)) {
          acc.authorsSeen.add(bookAuthor.author.id);
          acc.authors.push({ ...bookAuthor.author, type: "author" });
        }
        if (!acc.peopleSeen.has(bookAuthor.author.person.id)) {
          acc.peopleSeen.add(bookAuthor.author.person.id);
        }
      });

      seriesBook.book.media.forEach((media) => {
        media.mediaNarrators.forEach((mediaNarrator) => {
          if (!acc.narratorsSeen.has(mediaNarrator.narrator.id)) {
            acc.narratorsSeen.add(mediaNarrator.narrator.id);
            acc.narrators.push({ ...mediaNarrator.narrator, type: "narrator" });
          }
          if (acc.peopleSeen.has(mediaNarrator.narrator.person.id)) {
            acc.authors.forEach((author) => {
              if (author.person.id === mediaNarrator.narrator.person.id) {
                author.type = "both";
              }
            });
            acc.narrators.forEach((narrator) => {
              if (narrator.person.id === mediaNarrator.narrator.person.id) {
                narrator.type = "skip";
              }
            });
          }
        });
      });

      return acc;
    },
    {
      authorsSeen: new Set<string>(),
      authors: [] as AuthorOrNarrator[],
      narratorsSeen: new Set<string>(),
      narrators: [] as AuthorOrNarrator[],
      peopleSeen: new Set<string>(),
    },
  );

  return (
    <Animated.FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { opacity }]}
      data={seriesBooks}
      keyExtractor={(item) => item.id}
      numColumns={2}
      ListHeaderComponent={() => (
        <Header authors={authors} narrators={narrators} />
      )}
      ListFooterComponent={() => (
        <Footer authors={authors} narrators={narrators} />
      )}
      renderItem={({ item }) => {
        return <SeriesBookTile style={styles.tile} seriesBook={item} />;
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
  },
  tile: {
    padding: 8,
    width: "50%",
    marginBottom: 8,
  },
});
