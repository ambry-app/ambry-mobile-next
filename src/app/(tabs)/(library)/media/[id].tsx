import Description from "@/src/components/Description";
import MediaImage from "@/src/components/MediaImage";
import NamesList from "@/src/components/NamesList";
import ScreenCentered from "@/src/components/ScreenCentered";
import { MediaForDetails, getMediaForDetails } from "@/src/db/library";
import { syncDown } from "@/src/db/sync";
import { useDownloadsStore } from "@/src/stores/downloads";
import { useSessionStore } from "@/src/stores/session";
import { useTrackPlayerStore } from "@/src/stores/trackPlayer";
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
          <MediaImage
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
                startDownload(
                  session,
                  mediaId,
                  media.mp4Path,
                  media.thumbnails,
                );
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
