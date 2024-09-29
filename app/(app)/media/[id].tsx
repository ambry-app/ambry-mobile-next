import { and, eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Image } from "expo-image";
import { Link, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { ScrollView, Text, View } from "react-native";

import LargeActivityIndicator from "@/components/LargeActivityIndicator";
import ScreenCentered from "@/components/ScreenCentered";
import { useSession } from "@/contexts/session";
import { db } from "@/db/db";
import * as schema from "@/db/schema";
import { Thumbnails } from "@/db/schema";
import { sync } from "@/db/sync";

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

export default function MediaDetails() {
  const { session } = useSession();
  const { id: mediaId } = useLocalSearchParams<{ id: string }>();
  const { error, data: media } = useLiveQuery(
    db.query.media.findFirst({
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
    }),
  );

  useFocusEffect(
    useCallback(() => {
      console.log("media/[id] focused!");

      try {
        sync(session!.url, session!.token!);
      } catch (error) {
        console.error("sync error:", error);
      }

      return () => {
        console.log("media/[id] unfocused");
      };
    }, [session]),
  );

  if (media === undefined) {
    return (
      <ScreenCentered>
        <LargeActivityIndicator />
      </ScreenCentered>
    );
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
        </View>
      </ScrollView>
    </>
  );
}
