import { DownloadedThumbnails, Thumbnails } from "@/src/db/schema";
import { useSessionStore } from "@/src/stores/session";
import { Image } from "expo-image";
import { Image as RNImage, StyleProp, View, ViewStyle } from "react-native";
import colors from "tailwindcss/colors";

export default function ThumbnailImage({
  downloadedThumbnails,
  thumbnails,
  size,
  className,
}: {
  downloadedThumbnails?: DownloadedThumbnails | null;
  thumbnails?: Thumbnails | null;
  size: "extraSmall" | "small" | "medium" | "large" | "extraLarge";
  className?: string;
}) {
  const session = useSessionStore((state) => state.session);

  if (session && downloadedThumbnails) {
    return (
      <View className={(className || "") + " overflow-hidden"}>
        <Image
          source={{
            uri: downloadedThumbnails[size],
          }}
          style={{ width: "100%", height: "100%" }}
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
      <View className={(className || "") + " overflow-hidden"}>
        <Image
          source={{
            uri: `${session.url}/${thumbnails[size]}`,
            headers: { Authorization: `Bearer ${session.token}` },
          }}
          style={{ width: "100%", height: "100%" }}
          placeholder={{ thumbhash: thumbnails.thumbhash }}
          contentFit="cover"
          transition={0}
          cachePolicy={"memory-disk"}
        />
      </View>
    );
  }

  return (
    <View className={(className || "") + " overflow-hidden bg-zinc-900"} />
  );
}

export function ThumbnailImageNoTW({
  downloadedThumbnails,
  thumbnails,
  size,
  style,
}: {
  downloadedThumbnails?: DownloadedThumbnails | null;
  thumbnails?: Thumbnails | null;
  size: "extraSmall" | "small" | "medium" | "large" | "extraLarge";
  style?: StyleProp<ViewStyle>;
}) {
  const session = useSessionStore((state) => state.session);

  if (session && downloadedThumbnails) {
    return (
      <View style={[style, { overflow: "hidden" }]}>
        <Image
          source={{
            uri: downloadedThumbnails[size],
          }}
          style={{ width: "100%", height: "100%" }}
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
      <View style={[style, { overflow: "hidden" }]}>
        <Image
          source={{
            uri: `${session.url}/${thumbnails[size]}`,
            headers: { Authorization: `Bearer ${session.token}` },
          }}
          style={{ width: "100%", height: "100%" }}
          placeholder={{ thumbhash: thumbnails.thumbhash }}
          contentFit="cover"
          transition={0}
          cachePolicy={"memory-disk"}
        />
      </View>
    );
  }

  return (
    <View
      style={[style, { overflow: "hidden", backgroundColor: colors.zinc[900] }]}
    />
  );
}

export function ThumbnailImageNative({
  downloadedThumbnails,
  thumbnails,
  size,
  style,
}: {
  downloadedThumbnails?: DownloadedThumbnails | null;
  thumbnails?: Thumbnails | null;
  size: "extraSmall" | "small" | "medium" | "large" | "extraLarge";
  style?: StyleProp<ViewStyle>;
}) {
  const session = useSessionStore((state) => state.session);

  if (session && downloadedThumbnails) {
    return (
      <View style={[style, { overflow: "hidden" }]}>
        <RNImage
          source={{
            uri: downloadedThumbnails[size],
          }}
          style={{ width: "100%", height: "100%" }}
        />
      </View>
    );
  }

  if (session && thumbnails) {
    return (
      <View style={[style, { overflow: "hidden" }]}>
        <RNImage
          source={{
            uri: `${session.url}/${thumbnails[size]}`,
            headers: { Authorization: `Bearer ${session.token}` },
          }}
          style={{ width: "100%", height: "100%" }}
        />
      </View>
    );
  }

  return (
    <View
      style={[style, { overflow: "hidden", backgroundColor: colors.zinc[900] }]}
    />
  );
}
