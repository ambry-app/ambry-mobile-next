import Description from "@/src/components/Description";
import { useMediaDescription } from "@/src/db/library";
import { Session } from "@/src/stores/session";
import { formatPublished } from "@/src/utils/date";
import { Text, View } from "react-native";
import Animated from "react-native-reanimated";

type MediaDescriptionProps = {
  mediaId: string;
  session: Session;
};

export default function MediaDescription({
  mediaId,
  session,
}: MediaDescriptionProps) {
  const { media, opacity } = useMediaDescription(session, mediaId);

  if (!media?.description) return null;

  return (
    <Animated.View style={{ opacity }} className="gap-1 mt-8">
      <Description description={media.description} />
      <View>
        {media.book.published && (
          <Text className="text-sm text-zinc-400">
            First published{" "}
            {formatPublished(media.book.published, media.book.publishedFormat)}
          </Text>
        )}
        {media.published && (
          <Text className="text-sm text-zinc-400">
            This edition published{" "}
            {formatPublished(media.published, media.publishedFormat)}
          </Text>
        )}
        {media.publisher && (
          <Text className="text-sm text-zinc-400">by {media.publisher}</Text>
        )}
        {media.notes && (
          <Text className="text-sm text-zinc-400">Note: {media.notes}</Text>
        )}
      </View>
    </Animated.View>
  );
}
