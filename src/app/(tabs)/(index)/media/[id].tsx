import Description from "@/src/components/Description";
import ScreenCentered from "@/src/components/ScreenCentered";
import { Session, useSession } from "@/src/contexts/session";
import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Thumbnails } from "@/src/db/schema";
import { sync } from "@/src/db/sync";
import { and, eq } from "drizzle-orm";
import { Image } from "expo-image";
import { Link, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Button, ScrollView, Text, View } from "react-native";
import TrackPlayer, {
  Capability,
  PitchAlgorithm,
  TrackType,
} from "react-native-track-player";

type Person = {
  id: string;
};

type Author = {
  id: string;
  name: string;
  person: Person;
};

type BookAuthor = {
  id: string;
  author: Author;
};

type Series = {
  id: string;
  name: string;
};

type SeriesBook = {
  id: string;
  bookNumber: string;
  series: Series;
};

type Book = {
  id: string;
  title: string;
  bookAuthors: BookAuthor[];
  seriesBooks: SeriesBook[];
};

type Narrator = {
  id: string;
  name: string;
  person: Person;
};

type MediaNarrator = {
  id: string;
  narrator: Narrator;
};

type Media = {
  id: string;
  description: string | null;
  thumbnails: schema.Thumbnails | null;
  mpdPath: string | null;
  duration: string | null;
  book: Book;
  mediaNarrators: MediaNarrator[];
};

async function getMedia(
  session: Session,
  mediaId: string,
): Promise<Media | undefined> {
  return db.query.media.findFirst({
    columns: {
      id: true,
      thumbnails: true,
      description: true,
      mpdPath: true,
      duration: true,
    },
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

// TODO: put this somewhere better
async function playAsync(media: Media, session: Session) {
  console.log("play", `${session!.url}${media.mpdPath}`);
  await TrackPlayer.setupPlayer();

  await TrackPlayer.updateOptions({
    android: {
      alwaysPauseOnInterruption: true,
    },
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.JumpForward,
      Capability.JumpBackward,
      Capability.Stop,
    ],
    compactCapabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.JumpBackward,
      Capability.JumpForward,
    ],
    forwardJumpInterval: 10,
    backwardJumpInterval: 10,
  });

  await TrackPlayer.add({
    url: `${session!.url}${media.mpdPath}`,
    type: TrackType.Dash,
    pitchAlgorithm: PitchAlgorithm.Voice,
    // FIXME:
    duration: parseFloat(media.duration!),
    title: media.book.title,
    artist: media.book.bookAuthors
      .map((bookAuthor) => bookAuthor.author.name)
      .join(", "),
    // FIXME:
    artwork: `${session!.url}/${media.thumbnails!.extraLarge}`,
    description: media.id,
    headers: { Authorization: `Bearer ${session!.token}` },
  });
  await TrackPlayer.play();
}

export default function MediaDetails() {
  const { session } = useSession();
  const { id: mediaId } = useLocalSearchParams<{ id: string }>();
  const [media, setMedia] = useState<Media | undefined>();
  const [error, setError] = useState(false);

  const loadMedia = useCallback(() => {
    getMedia(session!, mediaId)
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

  const play = useCallback(() => {
    if (media === undefined) {
      return;
    }

    playAsync(media, session!)
      .then(() => {
        console.log("playback started");
      })
      .catch((error) => {
        console.error("playback error:", error);
      });
  }, [media, session]);

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
          <Button title="Play" onPress={play} />
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

function SeriesList({ seriesBooks }: { seriesBooks: SeriesBook[] }) {
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

function AuthorsList({ bookAuthors }: { bookAuthors: BookAuthor[] }) {
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
  mediaNarrators: MediaNarrator[];
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
