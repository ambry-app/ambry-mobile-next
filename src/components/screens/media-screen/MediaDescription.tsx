import { StyleSheet, Text, View } from "react-native";

import { Description } from "@/components/Description";
import { MediaHeaderInfo } from "@/services/library-service";
import { Colors } from "@/styles/colors";
import { formatPublished } from "@/utils/date";

type MediaDescriptionProps = {
  media: MediaHeaderInfo;
};

export function MediaDescription({ media }: MediaDescriptionProps) {
  if (!media?.description) return null;

  return (
    <View style={styles.container}>
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
    </View>
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
