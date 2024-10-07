import {
  BookAuthor,
  MediaNarrator,
  useLiveDownloadsList,
  type Download,
} from "@/src/db/downloads";
import { Thumbnails } from "@/src/db/schema";
import { useDownloadsStore } from "@/src/stores/downloads";
import { useSessionStore } from "@/src/stores/session";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { Image } from "expo-image";
import { Link } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import colors from "tailwindcss/colors";

export default function DownloadsScreen() {
  const session = useSessionStore((state) => state.session);
  const { data } = useLiveDownloadsList(session);

  if (data.length === 0) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-zinc-100 text-xl">
          You have no downloaded audiobooks.
        </Text>
        <Text className="text-zinc-100 text-xl">
          Go to the{" "}
          <Link href="/(library)/library" className="text-lime-400">
            library
          </Link>{" "}
          to download some!
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      className=""
      data={data}
      keyExtractor={(download) => download.media.id}
      renderItem={({ item }) => <DownloadRow download={item} />}
    />
  );
}

function DownloadRow({ download }: { download: Download }) {
  const session = useSessionStore((state) => state.session);
  const downloadProgress = useDownloadsStore(
    (state) => state.downloads[download.media.id],
  );
  const progress = downloadProgress?.progress;
  const removeDownload = useDownloadsStore((state) => state.removeDownload);

  if (!session) return null;

  return (
    <View>
      <View className="p-4 flex flex-row items-center gap-4 border-b-[0.25px] border-zinc-600">
        <MediaImage thumbnails={download.media.thumbnails} />
        <View className="flex-1">
          <Text className="text-zinc-100" numberOfLines={1}>
            {download.media.book.title}
          </Text>
          <AuthorList bookAuthors={download.media.book.bookAuthors} />
          <NarratorList mediaNarrators={download.media.mediaNarrators} />
        </View>
        <View className="pr-2">
          {download.status === "ready" && (
            <Pressable
              onPress={() => removeDownload(session, download.media.id)}
            >
              <FontAwesome6 size={24} name="trash" color={colors.zinc[100]} />
            </Pressable>
          )}
          {download.status === "error" && (
            <Pressable
              onPress={() => removeDownload(session, download.media.id)}
            >
              <FontAwesome6
                size={24}
                name="circle-exclamation"
                color={colors.red[500]}
              />
            </Pressable>
          )}

          {downloadProgress && (
            <ActivityIndicator
              animating={true}
              size={24}
              color={colors.zinc[200]}
            />
          )}
        </View>
      </View>
      {progress && (
        <View
          className="absolute h-1 bg-lime-400 left-0 bottom-0"
          style={{ width: `${progress * 100}%` }}
        />
      )}
    </View>
  );
}

function AuthorList({ bookAuthors }: { bookAuthors: BookAuthor[] }) {
  return (
    <Text className="text-sm text-zinc-300 leading-tight" numberOfLines={1}>
      {bookAuthors.map((bookAuthor, i) => [
        i > 0 && ", ",
        <Text key={i}>{bookAuthor.author.name}</Text>,
      ])}
    </Text>
  );
}

function NarratorList({ mediaNarrators }: { mediaNarrators: MediaNarrator[] }) {
  return (
    <Text className="text-xs text-zinc-400 leading-tight" numberOfLines={1}>
      Narrated by{" "}
      {mediaNarrators.map((mediaNarrator, i) => [
        i > 0 && ", ",
        <Text key={i}>{mediaNarrator.narrator.name}</Text>,
      ])}
    </Text>
  );
}

function MediaImage({ thumbnails }: { thumbnails: Thumbnails | null }) {
  const session = useSessionStore((state) => state.session);

  if (!thumbnails || !session) {
    return <View className="w-14 h-14 rounded-sm bg-zinc-700" />;
  }

  const source = {
    uri: `${session.url}/${thumbnails.small}`,
    headers: { Authorization: `Bearer ${session.token}` },
  };
  const placeholder = { thumbhash: thumbnails.thumbhash };

  return (
    <Image
      source={source}
      style={{ height: 56, width: 56, borderRadius: 3 }}
      placeholder={placeholder}
      contentFit="cover"
      transition={250}
    />
  );
}
