import { DownloadedThumbnails, Thumbnails } from "@/src/db/schema";
import { Colors } from "@/src/styles";
import { ImageStyle } from "expo-image";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import ThumbnailImage from "./ThumbnailImage";

type MultiThumbnailImageProps = {
  thumbnailPairs: {
    thumbnails: Thumbnails | null;
    downloadedThumbnails: DownloadedThumbnails | null;
  }[];
  size: "extraSmall" | "small" | "medium" | "large" | "extraLarge";
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

export default function MultiThumbnailImage(props: MultiThumbnailImageProps) {
  const { thumbnailPairs, size, style, imageStyle } = props;

  if (thumbnailPairs.length === 0)
    return <View style={[styles.container, style]} />;

  if (thumbnailPairs.length === 1)
    return (
      <ThumbnailImage
        {...thumbnailPairs[0]}
        size={size}
        style={style}
        imageStyle={imageStyle}
      />
    );

  if (thumbnailPairs.length === 2)
    return (
      <View style={styles.multiContainer}>
        <View style={styles.firstOfTwo}>
          <ThumbnailImage
            {...thumbnailPairs[0]}
            size={size}
            style={[styles.blackBorder, style]}
            imageStyle={imageStyle}
          />
        </View>
        <View style={styles.secondOfTwo}>
          <ThumbnailImage
            {...thumbnailPairs[1]}
            size={size}
            style={[styles.blackBorder, style]}
            imageStyle={imageStyle}
          />
        </View>
      </View>
    );

  if (thumbnailPairs.length >= 3)
    return (
      <View style={styles.multiContainer}>
        <View style={styles.firstOfThree}>
          <ThumbnailImage
            {...thumbnailPairs[0]}
            size={size}
            style={[styles.blackBorder, style]}
            imageStyle={imageStyle}
          />
        </View>
        <View style={styles.secondOfThree}>
          <ThumbnailImage
            {...thumbnailPairs[1]}
            size={size}
            style={[styles.blackBorder, style]}
            imageStyle={imageStyle}
          />
        </View>
        <View style={styles.thirdOfThree}>
          <ThumbnailImage
            {...thumbnailPairs[2]}
            size={size}
            style={[styles.blackBorder, style]}
            imageStyle={imageStyle}
          />
        </View>
      </View>
    );
}

const styles = StyleSheet.create({
  blackBorder: {
    borderWidth: 1,
    borderColor: Colors.black,
  },
  container: {
    overflow: "hidden",
    backgroundColor: Colors.zinc[800],
  },
  multiContainer: {
    position: "relative",
  },
  firstOfTwo: {
    transform: [{ translateX: 4 }, { translateY: 4 }, { scale: 0.95 }],
  },
  secondOfTwo: {
    position: "absolute",
    top: 0,
    width: "100%",
    transform: [{ translateX: -4 }, { translateY: -4 }, { scale: 0.95 }],
  },
  firstOfThree: {
    transform: [{ translateX: 8 }, { translateY: 8 }, { scale: 0.9 }],
  },
  secondOfThree: {
    position: "absolute",
    top: 0,
    width: "100%",
    transform: [{ scale: 0.9 }],
  },
  thirdOfThree: {
    position: "absolute",
    top: 0,
    width: "100%",
    transform: [{ translateX: -8 }, { translateY: -8 }, { scale: 0.9 }],
  },
});
