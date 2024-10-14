import Description from "@/src/components/Description";
import NamesList from "@/src/components/NamesList";
import ThumbnailImage from "@/src/components/ThumbnailImage";
import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Thumbnails } from "@/src/db/schema";
import { syncDown } from "@/src/db/sync";
import { useDownloadsStore } from "@/src/stores/downloads";
import { Session, useSessionStore } from "@/src/stores/session";
import { useTrackPlayerStore } from "@/src/stores/trackPlayer";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { and, desc, eq, ne } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import {
  Link,
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import colors from "tailwindcss/colors";

// sections:
// [x] 1. image, title, series, authors, narrators
// [x] 2. action bar
// [x] 3. description + publishing info + notes
// [x] 4. author(s) and narrator(s)
// [x] 5?. other editions
// [x] 6?. other books in series
// [ ] 6a?. link to series screen
// [ ] 7?. other books by author

export default function MediaDetails() {
  const session = useSessionStore((state) => state.session);
  const { id: mediaId } = useLocalSearchParams<{ id: string }>();

  useFocusEffect(
    useCallback(() => {
      if (!session) return;

      // sync in background
      // if network is down, we just ignore the error
      syncDown(session).catch((error) => {
        console.error("sync error:", error);
      });
    }, [session]),
  );

  if (!session) return null;

  return (
    <ScrollView>
      <View className="p-4 flex gap-8">
        <Header mediaId={mediaId} session={session} />
        <ActionBar mediaId={mediaId} session={session} />
        <MediaDescription mediaId={mediaId} session={session} />
        <AuthorsAndNarrators mediaId={mediaId} session={session} />
        <OtherEditions mediaId={mediaId} session={session} />
        <OtherBooksInAllSeries mediaId={mediaId} session={session} />
      </View>
    </ScrollView>
  );
}

function Header({ mediaId, session }: { mediaId: string; session: Session }) {
  const { data: media } = useLiveQuery(
    db.query.media.findFirst({
      columns: {
        thumbnails: true,
      },
      where: and(
        eq(schema.media.url, session.url),
        eq(schema.media.id, mediaId),
      ),
      with: {
        download: {
          columns: { thumbnails: true },
        },
        mediaNarrators: {
          columns: {},
          with: {
            narrator: {
              columns: { name: true },
            },
          },
        },
        book: {
          columns: { title: true },
          with: {
            bookAuthors: {
              columns: {},
              with: {
                author: {
                  columns: { name: true },
                },
              },
            },
            seriesBooks: {
              columns: { bookNumber: true },
              with: { series: { columns: { name: true } } },
            },
          },
        },
      },
    }),
  );

  if (!media) return null;

  return (
    <View className="gap-2">
      <Stack.Screen options={{ title: media.book.title }} />
      <ThumbnailImage
        thumbnails={media.thumbnails}
        downloadedThumbnails={media.download?.thumbnails}
        size="extraLarge"
        className="w-full rounded-xl aspect-square"
      />
      <View>
        <Text className="text-2xl text-zinc-100 font-bold leading-tight">
          {media.book.title}
        </Text>
        {media.book.seriesBooks.length !== 0 && (
          <NamesList
            names={media.book.seriesBooks.map(
              (sb) => `${sb.series.name} #${sb.bookNumber}`,
            )}
            className="text-lg text-zinc-100 leading-tight"
          />
        )}
        <NamesList
          names={media.book.bookAuthors.map((ba) => ba.author.name)}
          className="text-lg text-zinc-300 leading-tight"
        />
        <NamesList
          prefix="Narrated by"
          names={media.mediaNarrators.map((mn) => mn.narrator.name)}
          className="text-zinc-400 leading-tight"
        />
      </View>
    </View>
  );
}

function ActionBar({
  mediaId,
  session,
}: {
  mediaId: string;
  session: Session;
}) {
  const progress = useDownloadsStore(
    (state) => state.downloadProgresses[mediaId],
  );
  const loadMediaIntoPlayer = useTrackPlayerStore((state) => state.loadMedia);
  const { startDownload } = useDownloadsStore();
  const router = useRouter();

  const { data: media } = useLiveQuery(
    db.query.media.findFirst({
      columns: {
        id: true,
        thumbnails: true,
        mp4Path: true,
      },
      where: and(
        eq(schema.media.url, session.url),
        eq(schema.media.id, mediaId),
      ),
      with: {
        download: {
          columns: { status: true },
        },
      },
    }),
  );

  if (!media) return null;

  if (media.download?.status !== "ready") {
    return (
      <View className="gap-2">
        <View className="flex flex-row bg-zinc-900 rounded-xl items-center">
          <Pressable
            className="grow border-r border-zinc-800 p-4"
            onPress={() => {
              loadMediaIntoPlayer(session, media.id);
              router.navigate("/");
            }}
          >
            <View className="flex items-center justify-end">
              <View>
                <FontAwesome6
                  name="play-circle"
                  size={32}
                  color={colors.zinc[100]}
                />
              </View>
              <View>
                <Text className="text-lg text-zinc-100">Stream</Text>
              </View>
            </View>
          </Pressable>
          <Pressable
            className="grow p-4"
            onPress={() => {
              if (!media.mp4Path) return;
              startDownload(session, media.id, media.mp4Path, media.thumbnails);
              router.navigate("/downloads");
            }}
          >
            <View className="flex items-center justify-end">
              <View>
                <FontAwesome6
                  name="download"
                  size={32}
                  color={colors.zinc[100]}
                />
              </View>
              <View>
                <Text className="text-lg text-zinc-100">Download</Text>
              </View>
            </View>
          </Pressable>
        </View>
        <Text className="text-zinc-500 text-sm leading-tight">
          Playing this audiobook will stream it and require an internet
          connection and may use your data plan.
        </Text>
      </View>
    );
  } else if (progress) {
    return (
      <View className="flex flex-row bg-zinc-900 rounded-xl items-center">
        <Pressable
          className="grow p-4"
          onPress={() => router.navigate("/downloads")}
        >
          <View className="flex items-center justify-end">
            <View>
              <ActivityIndicator size={36} color={colors.zinc[100]} />
            </View>
            <View>
              <Text className="text-lg text-zinc-100">Downloading...</Text>
            </View>
          </View>
        </Pressable>
      </View>
    );
  } else {
    return (
      <>
        <View className="flex flex-row bg-zinc-900 rounded-xl items-center">
          <Pressable
            className="grow p-4"
            onPress={() => {
              loadMediaIntoPlayer(session, media.id);
              router.navigate("/");
            }}
          >
            <View className="flex items-center justify-end">
              <View>
                <FontAwesome6
                  name="play-circle"
                  size={32}
                  color={colors.zinc[100]}
                />
              </View>
              <View>
                <Text className="text-lg text-zinc-100">Play</Text>
              </View>
            </View>
          </Pressable>
        </View>
        <Text className="text-zinc-500 text-sm leading-tight">
          You have this audiobook downloaded, it will play from your device and
          not require an internet connection.
        </Text>
      </>
    );
  }
}

function MediaDescription({
  mediaId,
  session,
}: {
  mediaId: string;
  session: Session;
}) {
  const { data: media } = useLiveQuery(
    db.query.media.findFirst({
      columns: {
        description: true,
        published: true,
        publishedFormat: true,
        publisher: true,
        notes: true,
      },
      with: {
        book: {
          columns: { published: true, publishedFormat: true },
        },
      },
      where: and(
        eq(schema.media.url, session.url),
        eq(schema.media.id, mediaId),
      ),
    }),
  );

  if (!media?.description) return null;

  return (
    <View className="gap-1">
      <Description description={media.description} />
      <View className="flex">
        {media.book.published && (
          <Text className="text-sm text-zinc-400">
            First published{" "}
            {formatPublished(media.book.published, media.book.publishedFormat)}
          </Text>
        )}
        {media.published && (
          <Text className="text-sm text-zinc-400">
            This edition published{" "}
            {formatPublished(media.published, media.publishedFormat)}
          </Text>
        )}
        {media.publisher && (
          <Text className="text-sm text-zinc-400">by {media.publisher}</Text>
        )}
        {media.notes && (
          <Text className="text-sm text-zinc-400">Note: {media.notes}</Text>
        )}
      </View>
    </View>
  );
}

function formatPublished(
  published: Date,
  publishedFormat: string,
  month: "short" | "long" = "long",
) {
  const options: Intl.DateTimeFormatOptions =
    publishedFormat === "full"
      ? { year: "numeric", month, day: "numeric" }
      : publishedFormat === "year_month"
        ? { year: "numeric", month }
        : { year: "numeric" };
  return new Intl.DateTimeFormat("en-US", options).format(published);
}

function AuthorsAndNarrators({
  mediaId,
  session,
}: {
  mediaId: string;
  session: Session;
}) {
  const { data: media } = useLiveQuery(
    db.query.media.findFirst({
      columns: {},
      where: and(
        eq(schema.media.url, session.url),
        eq(schema.media.id, mediaId),
      ),
      with: {
        book: {
          columns: {},
          with: {
            bookAuthors: {
              columns: { id: true },
              with: {
                author: {
                  columns: { name: true },
                  with: {
                    person: {
                      columns: { id: true, name: true, thumbnails: true },
                    },
                  },
                },
              },
            },
          },
        },
        mediaNarrators: {
          columns: { id: true },
          with: {
            narrator: {
              columns: { name: true },
              with: {
                person: { columns: { id: true, name: true, thumbnails: true } },
              },
            },
          },
        },
      },
    }),
  );

  if (!media) return null;

  return (
    <View>
      <Text className="text-2xl font-bold text-zinc-100 mb-2">
        Author{media.book.bookAuthors.length > 1 && "s"} & Narrator
        {media.mediaNarrators.length > 1 && "s"}
      </Text>
      <FlatList
        className="p-2"
        data={[...media.book.bookAuthors, ...media.mediaNarrators]}
        keyExtractor={(item) => item.id}
        horizontal={true}
        renderItem={({ item }) => {
          if ("author" in item)
            return (
              <PersonTile
                label="Author"
                personId={item.author.person.id}
                name={item.author.name}
                realName={item.author.person.name}
                thumbnails={item.author.person.thumbnails}
              />
            );

          if ("narrator" in item)
            return (
              <PersonTile
                label="Narrator"
                personId={item.narrator.person.id}
                name={item.narrator.name}
                realName={item.narrator.person.name}
                thumbnails={item.narrator.person.thumbnails}
              />
            );

          // can't happen:
          return null;
        }}
      />
    </View>
  );
}

function PersonTile({
  personId,
  name,
  realName,
  thumbnails,
  label,
}: {
  personId: string;
  name: string;
  realName?: string;
  thumbnails: Thumbnails | null;
  label: string;
}) {
  return (
    <Link
      href={{
        pathname: "/person/[id]",
        params: { id: personId },
      }}
      asChild
    >
      <Pressable>
        <View className="flex items-center w-44 mr-4">
          <ThumbnailImage
            thumbnails={thumbnails}
            size="large"
            className="w-44 rounded-full aspect-square"
          />
          <Text
            className="text-lg text-zinc-100 font-semibold text-center"
            numberOfLines={1}
          >
            {name}
          </Text>
          {realName !== name && (
            <Text className="text-zinc-300 text-center" numberOfLines={1}>
              ({realName})
            </Text>
          )}
          <Text className="text-sm text-zinc-400 text-center">{label}</Text>
        </View>
      </Pressable>
    </Link>
  );
}

function OtherEditions({
  mediaId,
  session,
}: {
  mediaId: string;
  session: Session;
}) {
  const { data: media } = useLiveQuery(
    db.query.media.findFirst({
      columns: {},
      where: and(
        eq(schema.media.url, session.url),
        eq(schema.media.id, mediaId),
      ),
      with: {
        book: {
          columns: {},
          with: {
            media: {
              columns: {
                id: true,
                thumbnails: true,
                published: true,
                publishedFormat: true,
                publisher: true,
              },
              orderBy: desc(schema.media.published),
              where: ne(schema.media.id, mediaId),
              with: {
                // TODO: we could also include downloads for offline images
                mediaNarrators: {
                  columns: {},
                  with: {
                    narrator: {
                      columns: { name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  );

  if (!media) return null;
  if (media.book.media.length === 0) return null;

  return (
    <View>
      <Text className="text-2xl font-bold text-zinc-100 mb-2">
        Other Editions
      </Text>
      <FlatList
        className="p-2"
        data={[...media.book.media]}
        keyExtractor={(item) => item.id}
        horizontal={true}
        renderItem={({ item }) => {
          return <EditionTile media={item} />;
        }}
      />
    </View>
  );
}

function EditionTile({
  media,
}: {
  media: {
    id: string;
    thumbnails: schema.Thumbnails | null;
    published: Date | null;
    publishedFormat: "full" | "year_month" | "year";
    publisher: string | null;
    mediaNarrators: {
      narrator: {
        name: string;
      };
    }[];
  };
}) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => {
        router.push({
          pathname: "/media/[id]",
          params: { id: media.id },
        });
      }}
    >
      <View className="flex w-44 mr-4">
        <ThumbnailImage
          thumbnails={media.thumbnails}
          size="large"
          className="w-44 rounded-lg aspect-square"
        />
        <NamesList
          prefix="Narrated by"
          names={media.mediaNarrators.map((mn) => mn.narrator.name)}
          className="text-zinc-100"
          numberOfLines={1}
        />
        {media.published && (
          <Text className="text-sm text-zinc-400" numberOfLines={1}>
            Published{" "}
            {formatPublished(media.published, media.publishedFormat, "short")}
          </Text>
        )}
        {media.publisher && (
          <Text className="text-sm text-zinc-400" numberOfLines={1}>
            by {media.publisher}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function OtherBooksInAllSeries({
  mediaId,
  session,
}: {
  mediaId: string;
  session: Session;
}) {
  const { data: media } = useLiveQuery(
    db.query.media.findFirst({
      columns: {},
      where: and(
        eq(schema.media.url, session.url),
        eq(schema.media.id, mediaId),
      ),
      with: {
        book: {
          columns: {},
          with: {
            seriesBooks: {
              columns: {},
              with: {
                series: {
                  columns: { id: true },
                },
              },
            },
          },
        },
      },
    }),
  );

  if (!media) return null;
  if (media.book.seriesBooks.length === 0) return null;

  return (
    <>
      {media.book.seriesBooks.map((seriesBook) => (
        <OtherBooksInSeries
          key={seriesBook.series.id}
          seriesId={seriesBook.series.id}
          session={session}
        />
      ))}
    </>
  );
}

function OtherBooksInSeries({
  seriesId,
  session,
}: {
  seriesId: string;
  session: Session;
}) {
  const { data: series } = useLiveQuery(
    db.query.series.findFirst({
      columns: { name: true },
      where: and(
        eq(schema.series.url, session.url),
        eq(schema.series.id, seriesId),
      ),
      with: {
        seriesBooks: {
          columns: { id: true, bookNumber: true },
          with: {
            book: {
              columns: { id: true, title: true },
              with: {
                bookAuthors: {
                  columns: {},
                  with: { author: { columns: { name: true } } },
                },
                media: {
                  columns: { id: true, thumbnails: true },
                  with: {
                    mediaNarrators: {
                      columns: {},
                      with: {
                        narrator: { columns: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  );

  if (!series) return null;

  series.seriesBooks.sort(
    (a, b) => parseFloat(a.bookNumber) - parseFloat(b.bookNumber),
  );

  return (
    <View>
      <Text className="text-2xl font-bold text-zinc-100 mb-2">
        {series.name}
      </Text>
      <FlatList
        className="p-2"
        data={series.seriesBooks}
        keyExtractor={(item) => item.id}
        horizontal={true}
        renderItem={({ item }) => {
          return <SeriesBookTile seriesBook={item} />;
        }}
      />
    </View>
  );
}

function SeriesBookTile({
  seriesBook,
}: {
  seriesBook: {
    id: string;
    bookNumber: string;

    book: {
      id: string;
      title: string;
      bookAuthors: {
        author: {
          name: string;
        };
      }[];
      media: {
        id: string;
        thumbnails: schema.Thumbnails | null;
        mediaNarrators: {
          narrator: {
            name: string;
          };
        }[];
      }[];
    };
  };
}) {
  // TODO: image stack?
  const router = useRouter();

  return (
    <Pressable
      onPress={() => {
        router.push({
          pathname: "/media/[id]",
          params: { id: seriesBook.book.media[0].id },
        });
      }}
    >
      <View className="flex w-44 mr-4 gap-1">
        <Text className="text-lg text-zinc-100 font-semibold" numberOfLines={1}>
          Book {seriesBook.bookNumber}
        </Text>
        <ThumbnailImage
          thumbnails={seriesBook.book.media[0].thumbnails}
          size="large"
          className="w-44 rounded-lg aspect-square"
        />
        <View>
          <Text
            className="text-lg leading-tight font-medium text-zinc-100"
            numberOfLines={1}
          >
            {seriesBook.book.title}
          </Text>
          <NamesList
            names={seriesBook.book.bookAuthors.map((ba) => ba.author.name)}
            className="text-zinc-300 leading-tight"
            numberOfLines={1}
          />
        </View>
      </View>
    </Pressable>
  );
}
