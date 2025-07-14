import {
  BookDetailsText,
  IconButton,
  Loading,
  ThumbnailImage,
} from "@/src/components";
import { DownloadedMedia } from "@/src/db/library";
import { useDownloads } from "@/src/stores/downloads";
import { Colors } from "@/src/styles";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useShallow } from "zustand/shallow";
import { FileSize } from "./FileSize";

type DownloadRowProps = {
  media: DownloadedMedia;
};

export function DownloadRow({ media }: DownloadRowProps) {
  const { filePath, status } = useDownloads(
    useShallow((state) => {
      const { filePath, status } = state.downloads[media.id] || {};
      return { filePath, status };
    }),
  );

  if (!status) return null;

  const navigateToBook = () => {
    router.navigate({
      pathname: "/media/[id]",
      params: {
        id: media.id,
        title: media.book.title,
      },
    });
  };

  const openModal = () => {
    router.navigate({
      pathname: "/download-actions-modal/[id]",
      params: {
        id: media.id,
      },
    });
  };

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity onPress={navigateToBook}>
          <ThumbnailImage
            downloadedThumbnails={media.download?.thumbnails}
            thumbnails={media.thumbnails}
            size="small"
            style={{ width: 70, height: 70, borderRadius: 6 }}
          />
        </TouchableOpacity>
        <View style={styles.details}>
          <TouchableOpacity onPress={navigateToBook}>
            <BookDetailsText
              baseFontSize={14}
              title={media.book.title}
              authors={media.book.authors.map((author) => author.name)}
              narrators={media.narrators.map((narrator) => narrator.name)}
            />
            {status === "ready" && <FileSize filePath={filePath!} />}
          </TouchableOpacity>
        </View>
        <View>
          {status === "error" && (
            <FontAwesome6
              size={24}
              name="circle-exclamation"
              color={Colors.red[400]}
            />
          )}
        </View>
        <LoadingIndicator mediaId={media.id} />
        <View>
          <IconButton
            size={16}
            icon="ellipsis-vertical"
            color={Colors.zinc[100]}
            onPress={openModal}
          />
        </View>
      </View>
      <DownloadProgressBar mediaId={media.id} />
    </>
  );
}

function LoadingIndicator({ mediaId }: { mediaId: string }) {
  const { progress, status } = useDownloads(
    useShallow((state) => {
      const { progress, status } = state.downloads[mediaId] || {};
      return { progress, status };
    }),
  );

  if (!status || (!progress && status !== "pending")) return null;

  return (
    <View>
      <Loading size={24} />
    </View>
  );
}

function DownloadProgressBar({ mediaId }: { mediaId: string }) {
  const progress = useDownloads(
    useShallow((state) => state.downloads[mediaId]?.progress),
  );

  if (!progress) return null;

  return <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />;
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.zinc[600],
  },
  details: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  },
  progressBar: {
    position: "absolute",
    height: 4,
    backgroundColor: Colors.lime[400],
    left: 0,
    bottom: 0,
  },
});
