import { and, eq } from "drizzle-orm";
import { Image } from "expo-image";
import { Link, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import Description from "@/components/Description";
import ScreenCentered from "@/components/ScreenCentered";
import { Session, useSession } from "@/contexts/session";
import { db } from "@/db/db";
import * as schema from "@/db/schema";
import { Thumbnails } from "@/db/schema";
import { sync } from "@/db/sync";

export type MediaForDetails = {
  id: string;
  description: string | null;
  thumbnails: schema.Thumbnails | null;
  book: {
    id: string;
    title: string;
    bookAuthors: {
      id: string;
      author: {
        id: string;
        name: string;
        person: {
          id: string;
        };
      };
    }[];
    seriesBooks: {
      id: string;
      bookNumber: string;
      series: {
        id: string;
        name: string;
      };
    }[];
  };
  mediaNarrators: {
    id: string;
    narrator: {
      id: string;
      name: string;
      person: {
        id: string;
      };
    };
  }[];
};

async function getMediaForDetails(
  session: Session,
  mediaId: string,
): Promise<MediaForDetails | undefined> {
  return db.query.media.findFirst({
    columns: { id: true, thumbnails: true, description: true },
    where: and(
      eq(schema.media.url, session!.url),
      eq(schema.media.id, mediaId),
    ),
    with: {
      mediaNarrators: {
        columns: { id: true },
        with: {
          narrator: {
            columns: { id: true, name: true },
            with: { person: { columns: { id: true } } },
          },
        },
      },
      book: {
        columns: { id: true, title: true },
        with: {
          bookAuthors: {
            columns: { id: true },
            with: {
              author: {
                columns: { id: true, name: true },
                with: { person: { columns: { id: true } } },
              },
            },
          },
          seriesBooks: {
            columns: { id: true, bookNumber: true },
            with: { series: { columns: { id: true, name: true } } },
          },
        },
      },
    },
  });
}

export default function MediaDetails() {
  const { session } = useSession();
  const { id: mediaId } = useLocalSearchParams<{ id: string }>();
  const [media, setMedia] = useState<MediaForDetails | undefined>();
  const [error, setError] = useState(false);

  const loadMedia = useCallback(() => {
    getMediaForDetails(session!, mediaId)
      .then(setMedia)
      .catch((error) => {
        console.error("Failed to load media:", error);
        setError(true);
      });
  }, [session, mediaId]);

  useFocusEffect(
    useCallback(() => {
      console.log("media/[id] focused!");

      // load what's in the DB right now
      loadMedia();

      // sync in background, then load again
      // if network is down, we just ignore the error
      sync(session!.url, session!.token!)
        .then(loadMedia)
        .catch((error) => {
          console.error("sync error:", error);
        });

      return () => {
        console.log("media/[id] unfocused");
      };
    }, [loadMedia, session]),
  );

  if (media === undefined) {
    return null;
  }

  if (error) {
    console.error("Failed to load media:", error);

    return (
      <ScreenCentered>
        <Text className="text-red-500">Failed to load audiobook!</Text>
      </ScreenCentered>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: media.book.title }} />
      <ScrollView>
        <View className="p-4 flex gap-4">
          <MediaImage thumbnails={media.thumbnails} />
          <View>
            <Text className="text-2xl text-zinc-100 font-bold">
              {media.book.title}
            </Text>
            <SeriesList seriesBooks={media.book.seriesBooks} />
          </View>
          <View className="flex gap-1">
            <AuthorsList bookAuthors={media.book.bookAuthors} />
            <NarratorsList mediaNarrators={media.mediaNarrators} />
          </View>
          {media.description && <Description description={media.description} />}
        </View>
      </ScrollView>
    </>
  );
}

function MediaImage({ thumbnails }: { thumbnails: Thumbnails | null }) {
  const { session } = useSession();

  if (!thumbnails) {
    return (
      <View className="rounded-2xl bg-zinc-800 overflow-hidden">
        <View className="w-full" style={{ aspectRatio: 1 / 1 }} />
      </View>
    );
  }

  const source = {
    uri: `${session!.url}/${thumbnails.extraLarge}`,
    headers: { Authorization: `Bearer ${session!.token}` },
  };
  const placeholder = { thumbhash: thumbnails.thumbhash };

  return (
    <View className="rounded-2xl bg-zinc-800 overflow-hidden">
      <Image
        source={source}
        className="w-full"
        style={{ aspectRatio: 1 / 1 }}
        placeholder={placeholder}
        contentFit="cover"
        transition={250}
      />
    </View>
  );
}

function SeriesList({
  seriesBooks,
}: {
  seriesBooks: {
    id: string;
    bookNumber: string;
    series: {
      id: string;
      name: string;
    };
  }[];
}) {
  if (seriesBooks.length === 0) {
    return null;
  }

  return (
    <Text className="text-zinc-500 leading-tight">
      {seriesBooks.map((seriesBook, i) => [
        i > 0 && ", ",
        <Link
          key={i}
          href={{
            pathname: "/series/[id]",
            params: { id: seriesBook.series.id },
          }}
        >
          {seriesBook.series.name} #{seriesBook.bookNumber}
        </Link>,
      ])}
    </Text>
  );
}

function AuthorsList({
  bookAuthors,
}: {
  bookAuthors: {
    id: string;
    author: {
      id: string;
      name: string;
      person: {
        id: string;
      };
    };
  }[];
}) {
  if (bookAuthors.length === 0) {
    return null;
  }

  return (
    <Text className="text-lg text-zinc-400 leading-tight">
      Written by&nbsp;
      {bookAuthors.map((bookAuthor, i) => [
        i > 0 && ", ",
        <Link
          key={i}
          href={{
            pathname: "/person/[id]",
            params: { id: bookAuthor.author.person.id },
          }}
          className="text-zinc-200"
        >
          {bookAuthor.author.name}
        </Link>,
      ])}
    </Text>
  );
}

function NarratorsList({
  mediaNarrators,
}: {
  mediaNarrators: {
    id: string;
    narrator: {
      id: string;
      name: string;
      person: {
        id: string;
      };
    };
  }[];
}) {
  if (mediaNarrators.length === 0) {
    return null;
  }

  return (
    <Text className="text-lg text-zinc-400 leading-tight">
      Narrated by&nbsp;
      {mediaNarrators.map((mediaNarrator, i) => [
        i > 0 && ", ",
        <Link
          key={i}
          href={{
            pathname: "/person/[id]",
            params: { id: mediaNarrator.narrator.person.id },
          }}
          className="text-zinc-200"
        >
          {mediaNarrator.narrator.name}
        </Link>,
      ])}
    </Text>
  );
}
