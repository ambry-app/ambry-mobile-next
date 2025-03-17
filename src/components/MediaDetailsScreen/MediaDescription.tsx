import { Description } from "@/src/components";
import { useMediaDescription } from "@/src/db/library";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { formatPublished } from "@/src/utils/date";
import { StyleSheet, Text, View } from "react-native";
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
    <Animated.View style={[styles.container, { opacity }]}>
      <Description description={media.description} />
      <View>
        {media.book.published && (
          <Text style={styles.text}>
            First published{" "}
            {formatPublished(media.book.published, media.book.publishedFormat)}
          </Text>
        )}
        {media.published && (
          <Text style={styles.text}>
            This edition published{" "}
            {formatPublished(media.published, media.publishedFormat)}
          </Text>
        )}
        {media.publisher && (
          <Text style={styles.text}>by {media.publisher}</Text>
        )}
        {media.notes && <Text style={styles.text}>Note: {media.notes}</Text>}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: 32,
    gap: 4,
  },
  text: {
    fontSize: 12,
    color: Colors.zinc[400],
  },
});
