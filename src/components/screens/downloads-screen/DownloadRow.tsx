import { useCallback } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
import { partSubtitle, recordingTitle } from "@/utils/titles";

import { DownloadProgress } from "./DownloadProgress";
import { FileSize } from "./FileSize";

type DownloadRowProps = {
  media: DownloadedMedia;
  session: Session;
};

export function DownloadRow({ media, session }: DownloadRowProps) {
  const { filePath, files, status, bytesWritten, totalBytes } = useDownloads(
    useShallow((state) => {
      const { filePath, files, status, bytesWritten, totalBytes } =
        state.downloads[media.id] || {};
      return { filePath, files, status, bytesWritten, totalBytes };
    }),
  );

  // A direct-play recording is its files; legacy media is the one it has.
  const filePaths = files?.length
    ? files.map((file) => file.path)
    : filePath
      ? [filePath]
      : [];

  const onDelete = useCallback(() => {
    removeDownload(session, media.id);
  }, [session, media.id]);

  const onCancel = useCallback(() => {
    cancelDownload(session, media.id);
  }, [session, media.id]);

  if (!session || !status) return null;

  const part = partSubtitle(media.partNumber, media.set);

  const navigateToBook = () => {
    router.navigate({
      pathname: "/media/[id]",
      params: {
        id: media.id,
        title: recordingTitle(media.title, media.book.title),
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
            title={recordingTitle(media.title, media.book.title)}
            authors={media.book.authors.map((author) => author.name)}
            // which part this is beats who read it: parts of a set share a
            // title *and* a cast, so the narrators cannot tell these rows
            // apart and the part can. It takes the same line rather than a
            // new one, so a set's rows stay the height of every other row.
            narrators={part ? undefined : media.narrators.map((n) => n.name)}
          />
          {part && (
            <Text style={styles.partText} numberOfLines={1}>
              {part}
            </Text>
          )}
          {status === "ready" && <FileSize filePaths={filePaths} />}
          {status === "pending" &&
            (bytesWritten === undefined ? (
              // Before the first byte lands there is nothing to measure
              <View style={styles.loadingContainer}>
                <Loading size={16} />
              </View>
            ) : (
              <DownloadProgress
                bytesWritten={bytesWritten}
                totalBytes={totalBytes}
              />
            ))}
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
  partText: {
    // the narrators line this stands in for: baseFontSize - 4, same colour
    fontSize: 10,
    color: Colors.zinc[400],
  },
});
