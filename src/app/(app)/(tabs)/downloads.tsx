import IconButton from "@/src/components/IconButton";
import Loading from "@/src/components/Loading";
import ScreenCentered from "@/src/components/ScreenCentered";
import ThumbnailImage from "@/src/components/ThumbnailImage";
import TitleAuthorsNarrators from "@/src/components/TitleAuthorNarrator";
import { ListedDownload, useDownloadsList } from "@/src/db/downloads";
import { useDownloads } from "@/src/stores/downloads";
import { Session, useSession } from "@/src/stores/session";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import * as FileSystem from "expo-file-system";
import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated from "react-native-reanimated";
import colors from "tailwindcss/colors";

export default function DownloadsScreen() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return <DownloadsList session={session} />;
}

function DownloadsList({ session }: { session: Session }) {
  const { downloads, updatedAt, opacity } = useDownloadsList(session);

  if (updatedAt !== undefined && downloads.length === 0) {
    return (
      <ScreenCentered>
        <Text style={styles.noDownloadsText}>
          You have no downloaded audiobooks.
        </Text>
        <Text style={styles.noDownloadsText}>
          Go to the{" "}
          <Link
            href="/(app)/(tabs)/(library)"
            style={styles.noDownloadsLinkText}
          >
            library
          </Link>{" "}
          to download some!
        </Text>
      </ScreenCentered>
    );
  }

  return (
    <Animated.FlatList
      style={{ opacity }}
      data={downloads}
      keyExtractor={(download) => download.media.id}
      renderItem={({ item }) => <DownloadRow download={item} />}
    />
  );
}

type DownloadRowProps = {
  download: ListedDownload;
};

function DownloadRow({ download }: DownloadRowProps) {
  const progress = useDownloads(
    (state) => state.downloadProgresses[download.media.id],
  );

  const navigateToBook = () => {
    router.navigate({
      pathname: "/media/[id]",
      params: {
        id: download.media.id,
        title: download.media.book.title,
      },
    });
  };

  const openModal = () => {
    router.navigate({
      pathname: "/download-actions-modal/[id]",
      params: {
        id: download.media.id,
      },
    });
  };

  return (
    <>
      <View style={styles.downloadRowContainer}>
        <TouchableOpacity onPress={navigateToBook}>
          <ThumbnailImage
            downloadedThumbnails={download.thumbnails}
            thumbnails={download.media.thumbnails}
            size="small"
            style={{ width: 70, height: 70, borderRadius: 6 }}
          />
        </TouchableOpacity>
        <View style={styles.downloadRowDetails}>
          <TouchableOpacity onPress={navigateToBook}>
            <TitleAuthorsNarrators
              baseFontSize={14}
              title={download.media.book.title}
              authors={download.media.book.bookAuthors.map(
                (ba) => ba.author.name,
              )}
              narrators={download.media.mediaNarrators.map(
                (mn) => mn.narrator.name,
              )}
            />
            {download.status === "ready" && <FileSize download={download} />}
          </TouchableOpacity>
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
        <View>{progress !== undefined && <Loading size={24} />}</View>
        <View>
          <IconButton
            size={16}
            icon="ellipsis-vertical"
            color={colors.zinc[100]}
            onPress={openModal}
          />
        </View>
      </View>
      {progress !== undefined && (
        <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
      )}
    </>
  );
}

function FileSize({ download }: { download: ListedDownload }) {
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

  if (isMissing) return <Text style={styles.errorText}>file is missing!</Text>;

  if (!size) return null;

  return (
    <Text style={styles.fileSizeText} numberOfLines={1}>
      {size} and some more text here and some more text here and some more text
      here and some more text here and some more text here
    </Text>
  );
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

const styles = StyleSheet.create({
  noDownloadsText: {
    color: colors.zinc[100],
    fontSize: 18,
    textAlign: "center",
  },
  noDownloadsLinkText: {
    color: colors.lime[400],
  },
  errorText: {
    color: colors.red[500],
    fontSize: 10,
  },
  fileSizeText: {
    color: colors.zinc[400],
    fontSize: 10,
  },
  progressBar: {
    position: "absolute",
    height: 4,
    backgroundColor: colors.lime[400],
    left: 0,
    bottom: 0,
  },
  downloadRowContainer: {
    padding: 14,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.zinc[600],
  },
  downloadRowDetails: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  },
});
