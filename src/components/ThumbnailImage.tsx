import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Image, ImageStyle } from "expo-image";

import { DownloadedThumbnails, Thumbnails } from "@/services/library-service";
import { useSession } from "@/stores/session";
import { Colors } from "@/styles/colors";
import { documentDirectoryFilePath } from "@/utils/paths";

type ThumbnailImageProps = {
  downloadedThumbnails?: DownloadedThumbnails | null;
  thumbnails?: Thumbnails | null;
  size: "extraSmall" | "small" | "medium" | "large" | "extraLarge";
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

export function ThumbnailImage(props: ThumbnailImageProps) {
  const { downloadedThumbnails, thumbnails, size, style, imageStyle } = props;
  const session = useSession((state) => state.session);

  if (session && downloadedThumbnails) {
    return (
      <View style={[styles.container, style]}>
        <Image
          source={{
            uri: documentDirectoryFilePath(downloadedThumbnails[size]),
          }}
          style={styles.image}
          placeholder={{ thumbhash: downloadedThumbnails.thumbhash }}
          contentFit="cover"
          transition={0}
          cachePolicy={"memory-disk"}
        />
      </View>
    );
  }

  if (session && thumbnails) {
    return (
      <View style={[styles.container, style]}>
        <Image
          source={{
            uri: `${session.url}/${thumbnails[size]}`,
            headers: { Authorization: `Bearer ${session.token}` },
          }}
          style={[styles.image, imageStyle]}
          placeholder={{ thumbhash: thumbnails.thumbhash }}
          contentFit="cover"
          transition={0}
          cachePolicy={"memory-disk"}
        />
      </View>
    );
  }

  return <View style={[styles.container, style]} />;
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: Colors.zinc[800],
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
