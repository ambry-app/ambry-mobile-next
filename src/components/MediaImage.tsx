import { DownloadedThumbnails, Thumbnails } from "@/src/db/schema";
import { useSessionStore } from "@/src/stores/session";
import { Image } from "expo-image";
import { View } from "react-native";

export default function MediaImage({
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
          transition={250}
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
          transition={250}
        />
      </View>
    );
  }

  return (
    <View className={(className || "") + " overflow-hidden bg-zinc-700"} />
  );
}
