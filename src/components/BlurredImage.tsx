import { StyleProp } from "react-native";
import { Image, ImageStyle } from "expo-image";

import { DownloadedThumbnails, Thumbnails } from "@/services/library-service";
import { useSession } from "@/stores/session";
import { documentDirectoryFilePath } from "@/utils/paths";

type BlurredImageProps = {
  downloadedThumbnails?: DownloadedThumbnails | null;
  thumbnails?: Thumbnails | null;
  size: "extraSmall" | "small" | "medium" | "large" | "extraLarge";
  style?: StyleProp<ImageStyle>;
  blurRadius?: number;
};

export function BlurredImage(props: BlurredImageProps) {
  const {
    downloadedThumbnails,
    thumbnails,
    size,
    style,
    blurRadius = 1,
  } = props;
  const session = useSession((state) => state.session);

  if (session && downloadedThumbnails) {
    return (
      <Image
        source={{
          uri: documentDirectoryFilePath(downloadedThumbnails[size]),
        }}
        style={style}
        blurRadius={blurRadius}
        placeholder={{ thumbhash: downloadedThumbnails.thumbhash }}
        transition={0}
        cachePolicy={"memory-disk"}
      />
    );
  }

  if (session && thumbnails) {
    return (
      <Image
        source={{
          uri: `${session.url}/${thumbnails[size]}`,
          headers: { Authorization: `Bearer ${session.token}` },
        }}
        style={style}
        blurRadius={blurRadius}
        placeholder={{ thumbhash: thumbnails.thumbhash }}
        transition={0}
        cachePolicy={"memory-disk"}
      />
    );
  }

  return null;
}
