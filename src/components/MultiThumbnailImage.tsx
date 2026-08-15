import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { ImageStyle } from "expo-image";

import { DownloadedThumbnails, Thumbnails } from "@/services/library-service";
import { Colors, decorative } from "@/styles/colors";
import { STACK_LIMIT } from "@/utils/editions";

import { ThumbnailImage } from "./ThumbnailImage";

type ThumbnailPair = {
  thumbnails: Thumbnails | null;
  downloadedThumbnails: DownloadedThumbnails | null;
};

type MultiThumbnailImageProps = {
  /**
   * Covers front-to-back: index 0 faces the reader. Callers order these by
   * whatever they are stacking — newest edition first for a book, first part
   * first for a set — but the front of the stack is always the thing the tile
   * stands for. See `@/utils/editions`.
   */
  thumbnailPairs: ThumbnailPair[];
  size: "extraSmall" | "small" | "medium" | "large" | "extraLarge";
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

export function MultiThumbnailImage(props: MultiThumbnailImageProps) {
  const { thumbnailPairs, size, style, imageStyle } = props;
  const covers = thumbnailPairs.slice(0, STACK_LIMIT);

  if (covers.length === 0) return <View style={[styles.container, style]} />;

  if (covers.length === 1)
    return (
      <ThumbnailImage
        {...covers[0]!}
        size={size}
        style={style}
        imageStyle={imageStyle}
      />
    );

  const offsets = covers.length === 2 ? twoUp : threeUp;

  // Painted back to front, so the first cover ends up on top. The backmost
  // layer stays in normal flow and gives the stack its height; the rest sit
  // on top of it.
  const layers = covers
    .map((pair, index) => ({ pair, offset: offsets[index]! }))
    .reverse();

  return (
    <View style={styles.multiContainer}>
      {layers.map(({ pair, offset }, index) => (
        <View key={index} style={[offset, index === 0 ? null : styles.overlay]}>
          <ThumbnailImage
            {...pair}
            size={size}
            style={[styles.blackBorder, style]}
            imageStyle={imageStyle}
          />
        </View>
      ))}
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
    backgroundColor: decorative.placeholder,
  },
  multiContainer: {
    position: "relative",
  },
  overlay: {
    position: "absolute",
    top: 0,
    width: "100%",
  },
  frontOfTwo: {
    transform: [{ translateX: -4 }, { translateY: -4 }, { scale: 0.95 }],
  },
  backOfTwo: {
    transform: [{ translateX: 4 }, { translateY: 4 }, { scale: 0.95 }],
  },
  frontOfThree: {
    transform: [{ translateX: -8 }, { translateY: -8 }, { scale: 0.9 }],
  },
  middleOfThree: {
    transform: [{ scale: 0.9 }],
  },
  backOfThree: {
    transform: [{ translateX: 8 }, { translateY: 8 }, { scale: 0.9 }],
  },
});

// front-to-back, matching the order callers hand us
const twoUp = [styles.frontOfTwo, styles.backOfTwo];
const threeUp = [styles.frontOfThree, styles.middleOfThree, styles.backOfThree];
