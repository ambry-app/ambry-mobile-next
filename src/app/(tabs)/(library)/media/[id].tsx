import Description from "@/src/components/Description";
import ScreenCentered from "@/src/components/ScreenCentered";
import {
  BookAuthor,
  MediaForDetails,
  MediaNarrator,
  SeriesBook,
  getMediaForDetails,
} from "@/src/db/library";
import { Thumbnails } from "@/src/db/schema";
import { syncDown } from "@/src/db/sync";
import { useDownloadsStore } from "@/src/stores/downloads";
import { useSessionStore } from "@/src/stores/session";
import { useTrackPlayerStore } from "@/src/stores/trackPlayer";
import { Image } from "expo-image";
import {
  Link,
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useState } from "react";
import { Button, ScrollView, Text, View } from "react-native";

export default function MediaDetails() {
  const session = useSessionStore((state) => state.session);
  const loadMediaIntoPlayer = useTrackPlayerStore((state) => state.loadMedia);
  const { id: mediaId } = useLocalSearchParams<{ id: string }>();
  const [media, setMedia] = useState<MediaForDetails | undefined>();
  const [error, setError] = useState(false);

  const loadMedia = useCallback(() => {
    if (!session) return;

    getMediaForDetails(session, mediaId)
      .then(setMedia)
      .catch((error) => {
        console.error("Failed to load media:", error);
        setError(true);
      });
  }, [session, mediaId]);

  useFocusEffect(
    useCallback(() => {
      console.log("media/[id] focused!");
      if (!session) return;

      // load what's in the DB right now
      loadMedia();

      // sync in background, then load again
      // if network is down, we just ignore the error
      syncDown(session)
        .then(loadMedia)
        .catch((error) => {
          console.error("sync error:", error);
        });

      return () => {
        console.log("media/[id] unfocused");
      };
    }, [loadMedia, session]),
  );

  const { startDownload } = useDownloadsStore();

  const router = useRouter();

  if (!media || !session) {
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
          <Button
            title="Load Me!"
            onPress={() => {
              if (!session) return;
              loadMediaIntoPlayer(session, mediaId);
            }}
          />
          {!media.download && (
            <Button
              title="Download!"
              onPress={() => {
                if (!media.mp4Path) return;
                startDownload(session, mediaId, media.mp4Path);
                router.navigate("/downloads");
              }}
            />
          )}
          {media.download && (
            <Text className="text-lg text-zinc-100">
              You have this audiobook downloaded. Go to{" "}
              <Link href="/downloads" className="text-lime-400">
                downloads
              </Link>{" "}
              to manage downloaded files.
            </Text>
          )}
          {media.description && <Description description={media.description} />}
        </View>
      </ScrollView>
    </>
  );
}

function MediaImage({ thumbnails }: { thumbnails: Thumbnails | null }) {
  const session = useSessionStore((state) => state.session);

  if (!session) {
    return null;
  }

  if (!thumbnails) {
    return (
      <View className="rounded-2xl bg-zinc-800 overflow-hidden">
        <View className="w-full" style={{ aspectRatio: 1 / 1 }} />
      </View>
    );
  }

  const source = {
    uri: `${session.url}/${thumbnails.extraLarge}`,
    headers: { Authorization: `Bearer ${session.token}` },
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
