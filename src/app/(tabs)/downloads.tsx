import MediaImage from "@/src/components/MediaImage";
import NamesList from "@/src/components/NamesList";
import { useLiveDownloadsList, type Download } from "@/src/db/downloads";
import { useDownloadsStore } from "@/src/stores/downloads";
import { useSessionStore } from "@/src/stores/session";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import * as FileSystem from "expo-file-system";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
  const progress = useDownloadsStore(
    (state) => state.downloadProgresses[download.media.id],
  );
  const removeDownload = useDownloadsStore((state) => state.removeDownload);
  const cancelDownload = useDownloadsStore((state) => state.cancelDownload);
  const [isModalVisible, setIsModalVisible] = useState(false);

  if (!session) return null;

  return (
    <View>
      <View className="p-4 flex flex-row items-center gap-4 border-b-[0.25px] border-zinc-600">
        <MediaImage
          downloadedThumbnails={download.thumbnails}
          thumbnails={download.media.thumbnails}
          size="small"
          className="w-16 h-16 rounded-md"
        />
        <View className="flex-1">
          <Text className="text-zinc-100 font-medium" numberOfLines={1}>
            {download.media.book.title}
          </Text>
          <NamesList
            names={download.media.book.bookAuthors.map((ba) => ba.author.name)}
            className="text-sm text-zinc-300 leading-tight"
            numberOfLines={1}
          />
          <NamesList
            prefix="Narrated by"
            names={download.media.mediaNarrators.map((mn) => mn.narrator.name)}
            className="text-xs text-zinc-400 leading-tight"
            numberOfLines={1}
          />
          {download.status === "ready" && <FileSize download={download} />}
        </View>
        <View>
          {download.status === "error" && (
            <FontAwesome6
              size={24}
              name="circle-exclamation"
              color={colors.red[400]}
            />
          )}
        </View>
        <View>
          {progress !== undefined && (
            <ActivityIndicator
              animating={true}
              size={24}
              color={colors.zinc[200]}
            />
          )}
        </View>
        <View>
          <Pressable
            className="w-12 h-12 flex items-center justify-center"
            onPress={() => setIsModalVisible(true)}
          >
            <FontAwesome6
              size={16}
              name="ellipsis-vertical"
              color={colors.zinc[100]}
            />
          </Pressable>
        </View>
      </View>
      {progress !== undefined && (
        <View
          className="absolute h-1 bg-lime-400 left-0 bottom-0"
          style={{ width: `${progress * 100}%` }}
        />
      )}
      {isModalVisible && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={isModalVisible}
          statusBarTranslucent={true}
        >
          <Pressable onPress={() => setIsModalVisible(false)}>
            <View className="bg-black/80 w-full h-full">
              <View className="bg-zinc-800 rounded-lg absolute bottom-12 left-4 right-4">
                {download.status === "ready" && (
                  <Pressable
                    onPress={() => {
                      setIsModalVisible(false);
                      removeDownload(session, download.media.id);
                    }}
                  >
                    <View className="flex flex-row gap-6 items-center px-6">
                      <FontAwesome6
                        size={20}
                        name="trash"
                        color={colors.zinc[100]}
                      />
                      <Text className="text-zinc-100 p-6 rounded-lg">
                        Delete downloaded files
                      </Text>
                    </View>
                  </Pressable>
                )}
                {download.status !== "ready" && (
                  <Pressable
                    onPress={() => {
                      setIsModalVisible(false);
                      cancelDownload(session, download.media.id);
                    }}
                  >
                    <View className="flex flex-row gap-6 items-center px-6">
                      <FontAwesome6
                        size={20}
                        name="xmark"
                        color={colors.zinc[100]}
                      />
                      <Text className="text-zinc-100 p-6 rounded-lg">
                        Cancel download
                      </Text>
                    </View>
                  </Pressable>
                )}
              </View>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

function FileSize({ download }: { download: Download }) {
  const [size, setSize] = useState<string | null>(null);
  const [isMissing, setIsMissing] = useState(false);

  useEffect(() => {
    (async function () {
      const info = await FileSystem.getInfoAsync(download.filePath);
      if (!info.exists) {
        setIsMissing(true);
      }
      if (info.exists && !info.isDirectory) {
        setSize(formatBytes(info.size));
      }
    })();
  }, [download.filePath]);

  if (!size) return null;
  if (isMissing)
    return (
      <Text className="text-xs text-red-500 leading-tight">
        file is missing!
      </Text>
    );

  return <Text className="text-xs text-zinc-400 leading-tight">{size}</Text>;
}

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = [
    "Bytes",
    "KiB",
    "MiB",
    "GiB",
    "TiB",
    "PiB",
    "EiB",
    "ZiB",
    "YiB",
  ];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
