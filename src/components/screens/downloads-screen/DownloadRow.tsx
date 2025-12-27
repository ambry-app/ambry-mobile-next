import { StyleSheet, TouchableOpacity, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";
import { useShallow } from "zustand/shallow";

import {
  BookDetailsText,
  DownloadContextMenu,
  Loading,
  ThumbnailImage,
} from "@/components";
import { DownloadedMedia } from "@/db/library";
import { useThrottle } from "@/hooks/use-throttle";
import {
  cancelDownload,
  removeDownload,
  useDownloads,
} from "@/stores/downloads";
import { useSession } from "@/stores/session";
import { Colors } from "@/styles";

import { FileSize } from "./FileSize";

type DownloadRowProps = {
  media: DownloadedMedia;
};

export function DownloadRow({ media }: DownloadRowProps) {
  const session = useSession((state) => state.session);
  const { filePath, status } = useDownloads(
    useShallow((state) => {
      const { filePath, status } = state.downloads[media.id] || {};
      return { filePath, status };
    }),
  );

  if (!session || !status) return null;

  const navigateToBook = () => {
    router.navigate({
      pathname: "/media/[id]",
      params: {
        id: media.id,
        title: media.book.title,
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
        <DownloadContextMenu
          status={status}
          onDelete={() => removeDownload(session, media.id)}
          onCancel={() => cancelDownload(session, media.id)}
        />
      </View>
      <DownloadProgressBar mediaId={media.id} />
    </>
  );
}

function LoadingIndicator({ mediaId }: { mediaId: string }) {
  const { inProgress, status } = useDownloads(
    useShallow((state) => {
      const { progress, status } = state.downloads[mediaId] || {};
      return { inProgress: !!progress, status };
    }),
  );

  if (!status || (!inProgress && status !== "pending")) return null;

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
  const throttledProgress = useThrottle(progress, 100);

  if (!throttledProgress) return null;

  return (
    <View
      style={[styles.progressBar, { width: `${throttledProgress * 100}%` }]}
    />
  );
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
