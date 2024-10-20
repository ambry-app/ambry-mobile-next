import NamesList from "@/src/components/NamesList";
import PersonTile from "@/src/components/PersonTile";
import { SeriesBookTile } from "@/src/components/Tiles";
import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { useLiveTablesQuery } from "@/src/hooks/use.live.tables.query";
import useSyncOnFocus from "@/src/hooks/use.sync.on.focus";
import { Session, useSessionStore } from "@/src/stores/session";
import { and, eq, sql } from "drizzle-orm";
import { Stack, useLocalSearchParams } from "expo-router";
import { FlatList, Text, View } from "react-native";

export default function SeriesDetails() {
  const session = useSessionStore((state) => state.session);
  const { id: seriesId } = useLocalSearchParams<{ id: string }>();
  useSyncOnFocus();

  if (!session) return null;

  return <SeriesDetailsFlatList session={session} seriesId={seriesId} />;
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

function SeriesDetailsFlatList({
  seriesId,
  session,
}: {
  seriesId: string;
  session: Session;
}) {
  const { data: series } = useLiveTablesQuery(
    db.query.series.findFirst({
      columns: { id: true, name: true },
      where: and(
        eq(schema.series.url, session.url),
        eq(schema.series.id, seriesId),
      ),
      with: {
        seriesBooks: {
          columns: { id: true, bookNumber: true },
          orderBy: sql`CAST(book_number AS FLOAT)`,
          with: {
            book: {
              columns: { id: true, title: true },
              with: {
                bookAuthors: {
                  columns: {},
                  with: {
                    author: {
                      columns: { id: true, name: true },
                      with: {
                        person: {
                          columns: { id: true, name: true, thumbnails: true },
                        },
                      },
                    },
                  },
                },
                media: {
                  columns: { id: true, thumbnails: true },
                  with: {
                    mediaNarrators: {
                      columns: {},
                      with: {
                        narrator: {
                          columns: { id: true, name: true },
                          with: {
                            person: {
                              columns: {
                                id: true,
                                name: true,
                                thumbnails: true,
                              },
                            },
                          },
                        },
                      },
                    },
                    download: {
                      columns: { thumbnails: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    ["series"],
  );

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
    <>
      <Stack.Screen options={{ title: series.name }} />
      <FlatList
        className="px-2"
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
          return (
            <SeriesBookTile className="p-2 w-1/2 mb-2" seriesBook={item} />
          );
        }}
      />
    </>
  );
}

function Header({
  authors,
  narrators,
}: {
  authors: AuthorOrNarrator[];
  narrators: AuthorOrNarrator[];
}) {
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

function Footer({
  authors,
  narrators,
}: {
  authors: AuthorOrNarrator[];
  narrators: AuthorOrNarrator[];
}) {
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
