import Description from "@/src/components/Description";
import MultiThumbnailImage from "@/src/components/MultiThumbnailImage";
import NamesList from "@/src/components/NamesList";
import ThumbnailImage from "@/src/components/ThumbnailImage";
import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Thumbnails } from "@/src/db/schema";
import { syncDown } from "@/src/db/sync";
import { useLiveTablesQuery } from "@/src/hooks/use.live.tables.query";
import { useDownloadsStore } from "@/src/stores/downloads";
import { Session, useSessionStore } from "@/src/stores/session";
import { useTrackPlayerStore } from "@/src/stores/trackPlayer";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { and, desc, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import {
  Link,
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import colors from "tailwindcss/colors";

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

  return <MediaDetailsFlatList session={session} mediaId={mediaId} />;
}

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
  mediaId: string;
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
  const { data: media } = useLiveQuery(
    db.query.media.findFirst({
      columns: { bookId: true },
      where: and(
        eq(schema.media.url, session.url),
        eq(schema.media.id, mediaId),
      ),
      with: {
        book: {
          columns: {},
          with: {
            bookAuthors: {
              columns: { authorId: true },
            },
            seriesBooks: {
              columns: { seriesId: true },
            },
          },
        },
        mediaNarrators: {
          columns: { narratorId: true },
        },
      },
    }),
  );

  const [sections, setSections] = useState<Section[] | undefined>();

  useEffect(() => {
    if (!media) return;

    const collectedIds = {
      mediaId,
      bookId: media.bookId,
      authorIds: media.book.bookAuthors.map((ba) => ba.authorId),
      seriesIds: media.book.seriesBooks.map((sb) => sb.seriesId),
      narratorIds: media.mediaNarrators.map((mn) => mn.narratorId),
    };
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
      { id: `editions-${mediaId}`, type: "otherEditions", mediaId },
      ...collectedIds.seriesIds.map(
        (seriesId): OtherBooksInSeriesSection => ({
          id: `books-in-series-${seriesId}`,
          type: "otherBooksInSeries",
          seriesId,
        }),
      ),
      ...collectedIds.authorIds.map(
        (authorId): OtherBooksByAuthorSection => ({
          id: `other-books-${authorId}`,
          type: "otherBooksByAuthor",
          authorId,
          withoutBookId: collectedIds.bookId,
          withoutSeriesIds: collectedIds.seriesIds,
        }),
      ),
      ...collectedIds.narratorIds.map(
        (narratorId): OtherMediaByNarratorSection => ({
          id: `other-media-${narratorId}`,
          type: "otherMediaByNarrator",
          narratorId,
          withoutMediaId: mediaId,
          withoutSeriesIds: collectedIds.seriesIds,
        }),
      ),
    ];
    setSections(sections);
  }, [media, mediaId, session]);

  return sections;
}

function MediaDetailsFlatList({
  session,
  mediaId,
}: {
  session: Session;
  mediaId: string;
}) {
  const sections = useSections(mediaId, session);

  if (!sections) return null;

  return (
    <FlatList
      className="px-4"
      data={sections}
      keyExtractor={(item) => item.id}
      initialNumToRender={3}
      ListHeaderComponent={<View className="h-4" />}
      ListFooterComponent={<View className="h-4" />}
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
            return <OtherEditions mediaId={item.mediaId} session={session} />;
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

function Header({ mediaId, session }: { mediaId: string; session: Session }) {
  const { data: media } = useLiveQuery(
    db.query.media.findFirst({
      columns: {
        fullCast: true,
        abridged: true,
        thumbnails: true,
        duration: true,
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
        {media.mediaNarrators.length > 0 && (
          <NamesList
            prefix={
              media.fullCast ? "Read by a full cast including" : "Read by"
            }
            names={media.mediaNarrators.map((mn) => mn.narrator.name)}
            className="text-zinc-400 leading-tight"
          />
        )}
        {media.mediaNarrators.length === 0 && media.fullCast && (
          <Text className="text-zinc-400 leading-tight">
            Read by a full cast
          </Text>
        )}
      </View>
      {media.duration && (
        <View>
          <Text className=" text-zinc-500 leading-tight italic">
            {durationDisplay(media.duration)} {media.abridged && "(abridged)"}
          </Text>
        </View>
      )}
    </View>
  );
}

export function durationDisplay(input: string): string {
  const total = Number(input);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours === 0) {
    return `${minutes} minutes`;
  } else {
    return `${hours} hours and ${minutes} minutes`;
  }
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

  const { data: media } = useLiveTablesQuery(
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
    ["media", "downloads"],
  );

  if (!media) return null;

  if (progress) {
    return (
      <View className="flex flex-row bg-zinc-900 rounded-xl items-center mt-8">
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
  } else if (media.download && media.download.status !== "error") {
    return (
      <View className="gap-2 mt-8">
        <View className="flex flex-row bg-zinc-900 rounded-xl items-center">
          <Pressable
            className="grow p-4"
            onPress={() => {
              loadMediaIntoPlayer(session, media.id);
              router.navigate("/");
            }}
          >
            <View className="flex items-center justify-end">
              <View className="mb-2">
                <FontAwesome6
                  name="play-circle"
                  size={32}
                  color={colors.zinc[100]}
                />
              </View>
              <View>
                <Text className="text-lg text-zinc-100 leading-none">Play</Text>
              </View>
            </View>
          </Pressable>
        </View>
        <Text className="text-zinc-500 text-sm leading-tight">
          You have this audiobook downloaded, it will play from your device and
          not require an internet connection.
        </Text>
      </View>
    );
  } else {
    return (
      <View className="gap-2 mt-8">
        <View className="flex flex-row bg-zinc-900 rounded-xl items-center">
          <Pressable
            className="grow border-r border-zinc-800 p-4"
            onPress={() => {
              loadMediaIntoPlayer(session, media.id);
              router.navigate("/");
            }}
          >
            <View className="flex items-center justify-end">
              <View className="mb-2">
                <FontAwesome6
                  name="play-circle"
                  size={32}
                  color={colors.zinc[100]}
                />
              </View>
              <View>
                <Text className="text-lg text-zinc-100 leading-none">
                  Stream
                </Text>
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
              <View className="mb-2">
                <FontAwesome6
                  name="download"
                  size={32}
                  color={colors.zinc[100]}
                />
              </View>
              <View>
                <Text className="text-lg text-zinc-100 leading-none">
                  Download
                </Text>
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
    <View className="gap-1 mt-8">
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

  const [authorSet, setAuthorSet] = useState<Set<string>>(new Set<string>());
  const [narratorSet, setNarratorSet] = useState<Set<string>>(
    new Set<string>(),
  );

  useEffect(() => {
    if (!media) return;

    const newAuthorSet = new Set<string>();
    for (const ba of media.book.bookAuthors) {
      newAuthorSet.add(ba.author.person.id);
    }
    setAuthorSet(newAuthorSet);

    const newNarratorSet = new Set<string>();
    for (const mn of media.mediaNarrators) {
      newNarratorSet.add(mn.narrator.person.id);
    }
    setNarratorSet(newNarratorSet);
  }, [media]);

  if (!media) return null;

  return (
    <View className="mt-8">
      <Text
        className="text-2xl font-medium text-zinc-100 mb-2"
        numberOfLines={1}
      >
        Author{media.book.bookAuthors.length > 1 && "s"} & Narrator
        {media.mediaNarrators.length > 1 && "s"}
      </Text>
      <FlatList
        className="py-2"
        data={[...media.book.bookAuthors, ...media.mediaNarrators]}
        keyExtractor={(item) => item.id}
        horizontal={true}
        renderItem={({ item }) => {
          if ("author" in item) {
            const label = narratorSet.has(item.author.person.id)
              ? "Author & Narrator"
              : "Author";
            return (
              <PersonTile
                label={label}
                personId={item.author.person.id}
                name={item.author.name}
                realName={item.author.person.name}
                thumbnails={item.author.person.thumbnails}
              />
            );
          }

          if ("narrator" in item) {
            // skip if this person is also an author, as they were already rendered
            if (authorSet.has(item.narrator.person.id)) return null;

            return (
              <PersonTile
                label="Narrator"
                personId={item.narrator.person.id}
                name={item.narrator.name}
                realName={item.narrator.person.name}
                thumbnails={item.narrator.person.thumbnails}
              />
            );
          }

          // can't happen:
          console.error("unknown item:", item);
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
        <View className="flex items-center w-48 mr-4 gap-1">
          <ThumbnailImage
            thumbnails={thumbnails}
            size="large"
            className="w-48 rounded-full aspect-square"
          />
          <View>
            <Text
              className="text-lg text-zinc-100 font-medium text-center"
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
          columns: { id: true },
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

  const router = useRouter();

  if (!media) return null;
  if (media.book.media.length === 0) return null;

  return (
    <View className="mt-8">
      <Pressable
        onPress={() => {
          router.push({
            pathname: "/book/[id]",
            params: { id: media.book.id },
          });
        }}
      >
        <View className="flex flex-row items-center mb-2 justify-between">
          <Text
            className="text-2xl font-medium text-zinc-100"
            numberOfLines={1}
          >
            Other Editions
          </Text>
          <View className="mr-6">
            <FontAwesome6
              name="chevron-right"
              size={16}
              color={colors.zinc[100]}
            />
          </View>
        </View>
      </Pressable>
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
      <View className="flex w-48 mr-4 gap-1">
        <ThumbnailImage
          thumbnails={media.thumbnails}
          size="large"
          className="w-48 rounded-lg aspect-square"
        />
        <View>
          <NamesList
            prefix="Read by"
            names={media.mediaNarrators.map((mn) => mn.narrator.name)}
            className="text-zinc-100"
            numberOfLines={1}
          />
          {media.published && (
            <Text
              className="text-sm text-zinc-400 leading-tight"
              numberOfLines={1}
            >
              Published{" "}
              {formatPublished(media.published, media.publishedFormat, "short")}
            </Text>
          )}
          {media.publisher && (
            <Text
              className="text-sm text-zinc-400 leading-tight"
              numberOfLines={1}
            >
              by {media.publisher}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
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
      columns: { id: true, name: true },
      where: and(
        eq(schema.series.url, session.url),
        eq(schema.series.id, seriesId),
      ),
      with: {
        seriesBooks: {
          columns: { id: true, bookNumber: true },
          orderBy: sql`CAST(book_number AS FLOAT)`,
          limit: 10,
          with: {
            book: {
              columns: { id: true, title: true },
              with: {
                media: {
                  columns: { id: true, thumbnails: true },
                  with: {
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
  );

  const router = useRouter();

  if (!series) return null;

  return (
    <View className="mt-8">
      <Pressable
        onPress={() => {
          router.push({
            pathname: "/series/[id]",
            params: { id: series.id },
          });
        }}
      >
        <View className="flex flex-row items-center mb-2 justify-between">
          <Text
            className="text-2xl font-medium text-zinc-100"
            numberOfLines={1}
          >
            {series.name}
          </Text>
          <View className="mr-6">
            <FontAwesome6
              name="chevron-right"
              size={16}
              color={colors.zinc[100]}
            />
          </View>
        </View>
      </Pressable>
      <FlatList
        className="py-2"
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
      media: {
        id: string;
        thumbnails: schema.Thumbnails | null;
        download: {
          thumbnails: schema.DownloadedThumbnails | null;
        } | null;
      }[];
    };
  };
}) {
  // TODO: render an image stack
  const router = useRouter();

  if (seriesBook.book.media.length === 0) return null;

  return (
    <Pressable
      onPress={() => {
        if (seriesBook.book.media.length === 1) {
          router.push({
            pathname: "/media/[id]",
            params: { id: seriesBook.book.media[0].id },
          });
        } else {
          router.push({
            pathname: "/book/[id]",
            params: { id: seriesBook.book.id },
          });
        }
      }}
    >
      <View className="flex w-48 mr-4 gap-1">
        <Text className="text-lg text-zinc-100 font-medium" numberOfLines={1}>
          Book {seriesBook.bookNumber}
        </Text>
        <MultiThumbnailImage
          thumbnailPairs={seriesBook.book.media.map((m) => ({
            thumbnails: m.thumbnails,
            downloadedThumbnails: m.download?.thumbnails || null,
          }))}
          size="large"
          className="w-48 rounded-lg aspect-square"
        />
        <View>
          <Text
            className="text-lg leading-tight font-medium text-zinc-100"
            numberOfLines={2}
          >
            {seriesBook.book.title}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function OtherBooksByAuthor({
  authorId,
  session,
  withoutBookId,
  withoutSeriesIds,
}: {
  authorId: string;
  session: Session;
  withoutBookId: string;
  withoutSeriesIds: string[];
}) {
  const { data: booksIds } = useLiveQuery(
    db
      .selectDistinct({ id: schema.books.id })
      .from(schema.authors)
      .innerJoin(
        schema.bookAuthors,
        and(
          eq(schema.authors.url, schema.bookAuthors.url),
          eq(schema.authors.id, schema.bookAuthors.authorId),
        ),
      )
      .innerJoin(
        schema.books,
        and(
          eq(schema.bookAuthors.url, schema.books.url),
          eq(schema.bookAuthors.bookId, schema.books.id),
        ),
      )
      .leftJoin(
        schema.seriesBooks,
        and(
          eq(schema.books.url, schema.seriesBooks.url),
          eq(schema.books.id, schema.seriesBooks.bookId),
        ),
      )
      .orderBy(desc(schema.books.published))
      .limit(10)
      .where(
        and(
          eq(schema.authors.url, session.url),
          eq(schema.authors.id, authorId),
          ne(schema.books.id, withoutBookId),
          notInArray(schema.seriesBooks.seriesId, withoutSeriesIds),
        ),
      ),
  );

  const { data: author } = useLiveQuery(
    db.query.authors.findFirst({
      columns: { id: true, name: true },
      where: and(
        eq(schema.authors.url, session.url),
        eq(schema.authors.id, authorId),
      ),
      with: {
        person: {
          columns: { id: true, name: true },
        },
      },
    }),
  );

  const { data: books } = useLiveQuery(
    db.query.books.findMany({
      columns: { id: true, title: true },
      where: and(
        eq(schema.books.url, session.url),
        inArray(
          schema.books.id,
          booksIds.map((book) => book.id),
        ),
      ),
      orderBy: desc(schema.books.published),
      with: {
        media: {
          columns: { id: true, thumbnails: true },
        },
      },
    }),
    [booksIds],
  );

  const router = useRouter();

  if (!author) return null;

  if (books.length === 0) return null;

  return (
    <View className="mt-8">
      <Pressable
        onPress={() => {
          router.push({
            pathname: "/person/[id]",
            params: { id: author.person.id },
          });
        }}
      >
        <View className="flex flex-row items-center mb-2 justify-between">
          <Text
            className="text-2xl font-medium text-zinc-100"
            numberOfLines={1}
          >
            More by {author.name}
          </Text>
          <View className="mr-6">
            <FontAwesome6
              name="chevron-right"
              size={16}
              color={colors.zinc[100]}
            />
          </View>
        </View>
      </Pressable>
      <FlatList
        className="py-2"
        data={books}
        keyExtractor={(item) => item.id}
        horizontal={true}
        renderItem={({ item }) => {
          return <BookTile book={item} />;
        }}
      />
    </View>
  );
}

function BookTile({
  book,
}: {
  book: {
    id: string;
    title: string;
    media: {
      id: string;
      thumbnails: schema.Thumbnails | null;
    }[];
  };
}) {
  // TODO: render an image stack
  const router = useRouter();

  if (book.media.length === 0) return null;

  return (
    <Pressable
      onPress={() => {
        if (book.media.length === 1) {
          router.push({
            pathname: "/media/[id]",
            params: { id: book.media[0].id },
          });
        } else {
          router.push({
            pathname: "/book/[id]",
            params: { id: book.id },
          });
        }
      }}
    >
      <View className="flex w-48 mr-4 gap-1">
        <ThumbnailImage
          thumbnails={book.media[0].thumbnails}
          size="large"
          className="w-48 rounded-lg aspect-square"
        />
        <View>
          <Text
            className="text-lg leading-tight font-medium text-zinc-100"
            numberOfLines={2}
          >
            {book.title}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function OtherMediaByNarrator({
  narratorId,
  session,
  withoutMediaId,
  withoutSeriesIds,
}: {
  narratorId: string;
  session: Session;
  withoutMediaId: string;
  withoutSeriesIds: string[];
}) {
  const { data: mediaIds } = useLiveQuery(
    db
      .selectDistinct({ id: schema.media.id })
      .from(schema.narrators)
      .innerJoin(
        schema.mediaNarrators,
        and(
          eq(schema.narrators.url, schema.mediaNarrators.url),
          eq(schema.narrators.id, schema.mediaNarrators.narratorId),
        ),
      )
      .innerJoin(
        schema.media,
        and(
          eq(schema.mediaNarrators.url, schema.media.url),
          eq(schema.mediaNarrators.mediaId, schema.media.id),
        ),
      )
      .innerJoin(
        schema.books,
        and(
          eq(schema.media.url, schema.books.url),
          eq(schema.media.bookId, schema.books.id),
        ),
      )
      .leftJoin(
        schema.seriesBooks,
        and(
          eq(schema.books.url, schema.seriesBooks.url),
          eq(schema.books.id, schema.seriesBooks.bookId),
        ),
      )
      .orderBy(desc(schema.media.published))
      .limit(10)
      .where(
        and(
          eq(schema.narrators.url, session.url),
          eq(schema.narrators.id, narratorId),
          ne(schema.media.id, withoutMediaId),
          notInArray(schema.seriesBooks.seriesId, withoutSeriesIds),
        ),
      ),
  );

  const { data: narrator } = useLiveQuery(
    db.query.narrators.findFirst({
      columns: { id: true, name: true },
      where: and(
        eq(schema.narrators.url, session.url),
        eq(schema.narrators.id, narratorId),
      ),
      with: {
        person: {
          columns: { id: true, name: true },
        },
      },
    }),
  );

  const { data: media } = useLiveQuery(
    db.query.media.findMany({
      columns: { id: true, thumbnails: true },
      where: and(
        eq(schema.media.url, session.url),
        inArray(
          schema.media.id,
          mediaIds.map((media) => media.id),
        ),
      ),
      orderBy: desc(schema.media.published),
      with: {
        book: {
          columns: { id: true, title: true },
        },
      },
    }),
    [mediaIds],
  );

  const router = useRouter();

  if (!narrator) return null;

  if (media.length === 0) return null;

  return (
    <View className="mt-8">
      <Pressable
        onPress={() => {
          router.push({
            pathname: "/person/[id]",
            params: { id: narrator.person.id },
          });
        }}
      >
        <View className="flex flex-row items-center mb-2 justify-between">
          <Text
            className="text-2xl font-medium text-zinc-100"
            numberOfLines={1}
          >
            More read by {narrator.name}
          </Text>
          <View className="mr-6">
            <FontAwesome6
              name="chevron-right"
              size={16}
              color={colors.zinc[100]}
            />
          </View>
        </View>
      </Pressable>
      <FlatList
        className="py-2"
        data={media}
        keyExtractor={(item) => item.id}
        horizontal={true}
        renderItem={({ item }) => {
          return <MediaTile media={item} />;
        }}
      />
    </View>
  );
}

function MediaTile({
  media,
}: {
  media: {
    id: string;
    thumbnails: schema.Thumbnails | null;
    book: {
      id: string;
      title: string;
    };
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
      <View className="flex w-48 mr-4 gap-1">
        <ThumbnailImage
          thumbnails={media.thumbnails}
          size="large"
          className="w-48 rounded-lg aspect-square"
        />
        <View>
          <Text
            className="text-lg leading-tight font-medium text-zinc-100"
            numberOfLines={2}
          >
            {media.book.title}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
