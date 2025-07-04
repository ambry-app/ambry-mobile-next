import { Description, FadeInOnMount } from "@/src/components";
import { useMediaDescription } from "@/src/hooks/library";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { formatPublished } from "@/src/utils";
import { StyleSheet, Text, View } from "react-native";

type MediaDescriptionProps = {
  mediaId: string;
  session: Session;
};

export function MediaDescription(props: MediaDescriptionProps) {
  const { mediaId, session } = props;
  const { media } = useMediaDescription(session, mediaId);

  if (!media?.description) return null;

  return (
    <FadeInOnMount style={styles.container}>
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
    </FadeInOnMount>
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
