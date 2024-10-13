import Description from "@/src/components/Description";
import MediaImage from "@/src/components/MediaImage";
import NamesList from "@/src/components/NamesList";
import ScreenCentered from "@/src/components/ScreenCentered";
import { MediaForDetails, getMediaForDetails } from "@/src/db/library";
import { syncDown } from "@/src/db/sync";
import { useDownloadsStore } from "@/src/stores/downloads";
import { Session, useSessionStore } from "@/src/stores/session";
import { useTrackPlayerStore } from "@/src/stores/trackPlayer";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import colors from "tailwindcss/colors";

// TODO: section list:
// 1. image, title, series, authors, narrators
// 2. action bar
// 3. description
// 4. author(s) and narrator(s)
// 5?. other editions
// 6?. other books in series and series link
// 7?. other books by author

export default function MediaDetails() {
  const session = useSessionStore((state) => state.session);

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
          <ActionBar media={media} session={session} />
          {media.description && <Description description={media.description} />}
        </View>
      </ScrollView>
    </>
  );
}

function ActionBar({
  media,
  session,
}: {
  media: MediaForDetails;
  session: Session;
}) {
  const progress = useDownloadsStore(
    (state) => state.downloadProgresses[media.id],
  );
  const loadMediaIntoPlayer = useTrackPlayerStore((state) => state.loadMedia);
  const { startDownload } = useDownloadsStore();
  const router = useRouter();

  if (!media.download) {
    return (
      <>
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
      </>
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
