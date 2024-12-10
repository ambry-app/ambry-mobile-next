import { DownloadedThumbnails, Thumbnails } from "@/src/db/schema";
import { useSession } from "@/src/stores/session";
import { documentDirectoryFilePath } from "@/src/utils/paths";
import { Image, ImageStyle } from "expo-image";
import { StyleProp } from "react-native";

const blurRadius = 1;

type BlurredImageProps = {
  downloadedThumbnails?: DownloadedThumbnails | null;
  thumbnails?: Thumbnails | null;
  size: "extraSmall" | "small" | "medium" | "large" | "extraLarge";
  style?: StyleProp<ImageStyle>;
};

export default function BlurredImage(props: BlurredImageProps) {
  const { downloadedThumbnails, thumbnails, size, style } = props;
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
