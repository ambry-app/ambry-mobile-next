import NamesList from "@/src/components/NamesList";
import { Tile } from "@/src/components/Tiles";
import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { useLiveTablesQuery } from "@/src/hooks/use.live.tables.query";
import useSyncOnFocus from "@/src/hooks/use.sync.on.focus";
import { Session, useSession } from "@/src/stores/session";
import { formatPublished } from "@/src/utils/date";
import { and, eq } from "drizzle-orm";
import { Stack, useLocalSearchParams } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";

export default function BookDetails() {
  const session = useSession((state) => state.session);
  const { id: bookId, title } = useLocalSearchParams<{
    id: string;
    title: string;
  }>();
  useSyncOnFocus();

  if (!session) return null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <BookDetailsFlatList session={session} bookId={bookId} />
    </>
  );
}

function BookDetailsFlatList({
  bookId,
  session,
}: {
  bookId: string;
  session: Session;
}) {
  const { data: book } = useLiveTablesQuery(
    db.query.books.findFirst({
      columns: {
        id: true,
        title: true,
        published: true,
        publishedFormat: true,
      },
      where: and(
        eq(schema.books.url, session.url),
        eq(schema.books.id, bookId),
      ),
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
    }),
    ["books"],
  );

  if (!book) return null;

  return (
    <FlatList
      className="px-2"
      data={book.media}
      keyExtractor={(item) => item.id}
      numColumns={2}
      ListHeaderComponent={() => <Header book={book} />}
      renderItem={({ item }) => {
        return <Tile style={styles.tile} media={[item]} book={book} />;
      }}
    />
  );
}

type BookProp = {
  title: string;
  published: Date;
  publishedFormat: "full" | "year_month" | "year";
  bookAuthors: {
    author: {
      id: string;
      name: string;
      person: {
        id: string;
        name: string;
        thumbnails: schema.Thumbnails | null;
      };
    };
  }[];
  media: {
    id: string;
    thumbnails: schema.Thumbnails | null;
    mediaNarrators: {
      narrator: {
        id: string;
        name: string;
        person: {
          id: string;
          name: string;
          thumbnails: schema.Thumbnails | null;
        };
      };
    }[];
    download: {
      thumbnails: schema.DownloadedThumbnails | null;
    } | null;
  }[];
};

type HeaderProps = {
  book: BookProp;
};

function Header({ book }: HeaderProps) {
  return (
    <View className="p-2 gap-8">
      <View className="gap-1">
        <NamesList
          className="text-xl font-medium text-zinc-100 leading-tight"
          prefix="By"
          names={book.bookAuthors.map((ba) => ba.author.name)}
        />
        {book.published && (
          <Text className="text text-zinc-300">
            First published{" "}
            {formatPublished(book.published, book.publishedFormat)}
          </Text>
        )}
      </View>
      <Text className="text-2xl font-medium text-zinc-100" numberOfLines={1}>
        Editions
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    padding: 8,
    width: "50%",
    marginBottom: 8,
  },
});
