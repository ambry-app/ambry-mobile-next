import IconButton from "@/src/components/IconButton";
import Loading from "@/src/components/Loading";
import { useMediaActionBarInfo } from "@/src/db/library";
import { syncDownUser } from "@/src/db/sync";
import { startDownload, useDownloads } from "@/src/stores/downloads";
import { loadMedia, requestExpandPlayer } from "@/src/stores/player";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import colors from "tailwindcss/colors";

type ActionBarProps = {
  mediaId: string;
  session: Session;
};

export default function ActionBar({ mediaId, session }: ActionBarProps) {
  const progress = useDownloads((state) => state.downloadProgresses[mediaId]);
  const { media, opacity } = useMediaActionBarInfo(session, mediaId);

  if (!media) return null;

  if (progress) {
    return (
      <Animated.View
        style={{ opacity }}
        className="flex flex-row bg-zinc-900 rounded-xl items-center mt-8"
      >
        <Pressable
          className="grow p-4"
          onPress={() => router.navigate("/downloads")}
        >
          <View className="flex items-center justify-end">
            <View>
              <Loading size={36} />
            </View>
            <View>
              <Text className="text-lg text-zinc-100">Downloading...</Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  } else if (media.download && media.download.status !== "error") {
    return (
      <Animated.View style={{ opacity }} className="gap-2 mt-8">
        <View className="flex flex-row bg-zinc-900 rounded-xl items-center">
          <View className="grow flex items-center justify-center">
            <IconButton
              icon="play-circle"
              size={32}
              style={{ padding: 8 }}
              color={colors.zinc[100]}
              onPress={async () => {
                await syncDownUser(session, true);
                await loadMedia(session, media.id);
                requestExpandPlayer();
              }}
            >
              <Text className="text-lg text-zinc-100 leading-none mt-2">
                Play
              </Text>
            </IconButton>
          </View>
        </View>
        <Text className="text-zinc-500 text-sm leading-tight">
          You have this audiobook downloaded, it will play from your device and
          not require an internet connection.
        </Text>
      </Animated.View>
    );
  } else {
    return (
      <Animated.View style={{ opacity }} className="gap-2 mt-8">
        <View className="flex flex-row bg-zinc-900 rounded-xl items-center">
          <View className="grow border-r border-zinc-800 flex items-center justify-center">
            <IconButton
              icon="play-circle"
              size={32}
              style={{ padding: 8 }}
              color={colors.zinc[100]}
              onPress={async () => {
                await syncDownUser(session, true);
                await loadMedia(session, media.id);
                requestExpandPlayer();
              }}
            >
              <Text className="text-lg text-zinc-100 leading-none mt-2">
                Stream
              </Text>
            </IconButton>
          </View>
          <View className="grow flex items-center justify-center">
            <IconButton
              icon="download"
              size={32}
              style={{ padding: 8 }}
              color={colors.zinc[100]}
              onPress={() => {
                if (!media.mp4Path) return;
                startDownload(
                  session,
                  media.id,
                  media.mp4Path,
                  media.thumbnails,
                );
                router.navigate("/downloads");
              }}
            >
              <Text className="text-lg text-zinc-100 leading-none mt-2">
                Download
              </Text>
            </IconButton>
          </View>
        </View>
        <Text className="text-zinc-500 text-sm leading-tight">
          Playing this audiobook will stream it and require an internet
          connection and may use your data plan.
        </Text>
      </Animated.View>
    );
  }
}
