import { DownloadedThumbnails, Thumbnails } from "@/src/db/schema";
import { StyleProp, View, ViewStyle } from "react-native";
import colors from "tailwindcss/colors";
import ThumbnailImage, { ThumbnailImageNoTW } from "./ThumbnailImage";

export default function MultiThumbnailImage({
  thumbnailPairs,
  size,
  className,
}: {
  thumbnailPairs: {
    thumbnails: Thumbnails | null;
    downloadedThumbnails: DownloadedThumbnails | null;
  }[];
  size: "extraSmall" | "small" | "medium" | "large" | "extraLarge";
  className?: string;
}) {
  if (thumbnailPairs.length === 0)
    return (
      <View className={(className || "") + " overflow-hidden bg-zinc-900"} />
    );

  if (thumbnailPairs.length === 1)
    return (
      <ThumbnailImage
        {...thumbnailPairs[0]}
        size={size}
        className={className}
      />
    );

  if (thumbnailPairs.length === 2)
    return (
      <View className="relative">
        <View className="translate-x-1 translate-y-1 scale-95">
          <ThumbnailImage
            {...thumbnailPairs[0]}
            size={size}
            className={(className || "") + " border border-black"}
          />
        </View>
        <View className="absolute top-0 w-full -translate-x-1 -translate-y-1 scale-95">
          <ThumbnailImage
            {...thumbnailPairs[1]}
            size={size}
            className={(className || "") + " border border-black"}
          />
        </View>
      </View>
    );

  if (thumbnailPairs.length >= 3)
    return (
      <View className="relative">
        <View className="translate-x-2 translate-y-2 scale-90">
          <ThumbnailImage
            {...thumbnailPairs[0]}
            size={size}
            className={(className || "") + " border border-black"}
          />
        </View>
        <View className="absolute top-0 w-full scale-90">
          <ThumbnailImage
            {...thumbnailPairs[1]}
            size={size}
            className={(className || "") + " border border-black"}
          />
        </View>
        <View className="absolute top-0 w-full -translate-x-2 -translate-y-2 scale-90">
          <ThumbnailImage
            {...thumbnailPairs[2]}
            size={size}
            className={(className || "") + " border border-black"}
          />
        </View>
      </View>
    );
}

export function MultiThumbnailImageNoTW({
  thumbnailPairs,
  size,
  style,
}: {
  thumbnailPairs: {
    thumbnails: Thumbnails | null;
    downloadedThumbnails: DownloadedThumbnails | null;
  }[];
  size: "extraSmall" | "small" | "medium" | "large" | "extraLarge";
  style?: StyleProp<ViewStyle>;
}) {
  if (thumbnailPairs.length === 0)
    return (
      <View
        style={[
          style,
          { overflow: "hidden", backgroundColor: colors.zinc[900] },
        ]}
      />
    );

  if (thumbnailPairs.length === 1)
    return (
      <ThumbnailImageNoTW {...thumbnailPairs[0]} size={size} style={style} />
    );

  if (thumbnailPairs.length === 2)
    return (
      <View className="relative">
        <View className="translate-x-1 translate-y-1 scale-95">
          <ThumbnailImageNoTW
            {...thumbnailPairs[0]}
            size={size}
            // className={(className || "") + " border border-black"}
            style={[style, { borderWidth: 1, borderColor: colors.black }]}
          />
        </View>
        <View className="absolute top-0 w-full -translate-x-1 -translate-y-1 scale-95">
          <ThumbnailImageNoTW
            {...thumbnailPairs[1]}
            size={size}
            // className={(className || "") + " border border-black"}
            style={[style, { borderWidth: 1, borderColor: colors.black }]}
          />
        </View>
      </View>
    );

  if (thumbnailPairs.length >= 3)
    return (
      <View className="relative">
        <View className="translate-x-2 translate-y-2 scale-90">
          <ThumbnailImageNoTW
            {...thumbnailPairs[0]}
            size={size}
            // className={(className || "") + " border border-black"}
            style={[style, { borderWidth: 1, borderColor: colors.black }]}
          />
        </View>
        <View className="absolute top-0 w-full scale-90">
          <ThumbnailImageNoTW
            {...thumbnailPairs[1]}
            size={size}
            // className={(className || "") + " border border-black"}
            style={[style, { borderWidth: 1, borderColor: colors.black }]}
          />
        </View>
        <View className="absolute top-0 w-full -translate-x-2 -translate-y-2 scale-90">
          <ThumbnailImageNoTW
            {...thumbnailPairs[2]}
            size={size}
            // className={(className || "") + " border border-black"}
            style={[style, { borderWidth: 1, borderColor: colors.black }]}
          />
        </View>
      </View>
    );
}
