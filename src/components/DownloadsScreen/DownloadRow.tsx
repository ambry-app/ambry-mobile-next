import FileSize from "@/src/components/DownloadsScreen/FileSize";
import IconButton from "@/src/components/IconButton";
import Loading from "@/src/components/Loading";
import ThumbnailImage from "@/src/components/ThumbnailImage";
import TitleAuthorsNarrators from "@/src/components/TitleAuthorNarrator";
import { ListedDownload } from "@/src/db/downloads";
import { useDownloads } from "@/src/stores/downloads";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import colors from "tailwindcss/colors";

type DownloadRowProps = {
  download: ListedDownload;
};

export default function DownloadRow({ download }: DownloadRowProps) {
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
      <View style={styles.container}>
        <TouchableOpacity onPress={navigateToBook}>
          <ThumbnailImage
            downloadedThumbnails={download.thumbnails}
            thumbnails={download.media.thumbnails}
            size="small"
            style={{ width: 70, height: 70, borderRadius: 6 }}
          />
        </TouchableOpacity>
        <View style={styles.details}>
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

const styles = StyleSheet.create({
  container: {
    padding: 14,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.zinc[600],
  },
  details: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  },
  progressBar: {
    position: "absolute",
    height: 4,
    backgroundColor: colors.lime[400],
    left: 0,
    bottom: 0,
  },
});