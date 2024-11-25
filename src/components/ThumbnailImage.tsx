import { DownloadedThumbnails, Thumbnails } from "@/src/db/schema";
import { useSession } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { Image, ImageStyle } from "expo-image";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

type ThumbnailImageProps = {
  downloadedThumbnails?: DownloadedThumbnails | null;
  thumbnails?: Thumbnails | null;
  size: "extraSmall" | "small" | "medium" | "large" | "extraLarge";
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

export default function ThumbnailImage(props: ThumbnailImageProps) {
  const { downloadedThumbnails, thumbnails, size, style, imageStyle } = props;
  const session = useSession((state) => state.session);

  if (session && downloadedThumbnails) {
    return (
      <View style={[styles.container, style]}>
        <Image
          source={{
            uri: downloadedThumbnails[size],
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
