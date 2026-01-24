import { useCallback } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";
import { useShallow } from "zustand/shallow";

import { BookDetailsText } from "@/components/BookDetailsText";
import { DownloadContextMenu } from "@/components/DownloadContextMenu";
import { Loading } from "@/components/Loading";
import { ThumbnailImage } from "@/components/ThumbnailImage";
import { cancelDownload, removeDownload } from "@/services/download-service";
import { DownloadedMedia } from "@/services/library-service";
import { useDownloads } from "@/stores/downloads";
import { Colors } from "@/styles/colors";
import { Session } from "@/types/session";

import { FileSize } from "./FileSize";

type DownloadRowProps = {
  media: DownloadedMedia;
  session: Session;
};

export function DownloadRow({ media, session }: DownloadRowProps) {
  const { filePath, status } = useDownloads(
    useShallow((state) => {
      const { filePath, status } = state.downloads[media.id] || {};
      return { filePath, status };
    }),
  );

  const onDelete = useCallback(() => {
    removeDownload(session, media.id);
  }, [session, media.id]);

  const onCancel = useCallback(() => {
    cancelDownload(session, media.id);
  }, [session, media.id]);

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
          {status === "pending" && (
            <View style={styles.loadingContainer}>
              <Loading size={16} />
            </View>
          )}
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
      <DownloadContextMenu
        status={status}
        onDelete={onDelete}
        onCancel={onCancel}
      />
    </View>
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
  loadingContainer: {
    marginTop: 4,
    alignItems: "flex-start",
  },
});
