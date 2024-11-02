import NamesList from "@/src/components/NamesList";
import { PersonTile, SeriesBookTile } from "@/src/components/Tiles";
import { useSeriesDetails } from "@/src/db/library";
import * as schema from "@/src/db/schema";
import useSyncOnFocus from "@/src/hooks/use.sync.on.focus";
import { Session, useSession } from "@/src/stores/session";
import { RouterParams } from "@/src/types/router";
import { Stack, useLocalSearchParams } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

export default function SeriesDetailsScreen() {
  const session = useSession((state) => state.session);
  const { id: seriesId, title } = useLocalSearchParams<RouterParams>();
  useSyncOnFocus();

  if (!session) return null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <SeriesDetailsFlatList session={session} seriesId={seriesId} />
    </>
  );
}

type AuthorOrNarrator = {
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

function SeriesDetailsFlatList({
  seriesId,
  session,
}: SeriesDetailsFlatListProps) {
  const { data: series, opacity } = useSeriesDetails(session, seriesId);

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

type HeaderProps = {
  authors: AuthorOrNarrator[];
  narrators: AuthorOrNarrator[];
};

function Header({ authors, narrators }: HeaderProps) {
  return (
    <View className="p-2 gap-1">
      <NamesList
        names={authors.map((a) => a.name)}
        className="text-xl font-medium text-zinc-100 leading-tight"
        prefix="By"
      />
      <NamesList
        names={narrators.map((n) => n.name)}
        className="text-zinc-300 leading-tight mb-4"
        prefix="Read by"
      />
    </View>
  );
}

type FooterProps = {
  authors: AuthorOrNarrator[];
  narrators: AuthorOrNarrator[];
};

function Footer({ authors, narrators }: FooterProps) {
  return (
    <View className="mt-8">
      <Text
        className="text-2xl font-medium text-zinc-100 mb-2"
        numberOfLines={1}
      >
        Author{authors.length > 1 && "s"} & Narrator
        {narrators.length > 1 && "s"}
      </Text>
      <FlatList
        className="py-2"
        data={[...authors, ...narrators]}
        keyExtractor={(item) => item.id}
        horizontal={true}
        renderItem={({ item }) => {
          if (item.type === "skip") return null;

          return (
            <View className="w-48 mr-4">
              <PersonTile
                label={
                  item.type === "both"
                    ? "Author & Narrator"
                    : item.type === "author"
                      ? "Author"
                      : "Narrator"
                }
                personId={item.person.id}
                name={item.name}
                realName={item.person.name}
                thumbnails={item.person.thumbnails}
              />
            </View>
          );
        }}
      />
    </View>
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
