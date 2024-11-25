import { MediaTile } from "@/src/components/Tiles";
import { useMediaByNarrator } from "@/src/db/library";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { FlatList, StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";

type MediaByNarratorProps = {
  narratorId: string;
  session: Session;
};

export default function MediaByNarrator({
  narratorId,
  session,
}: MediaByNarratorProps) {
  const { media, narrator, opacity } = useMediaByNarrator(session, narratorId);

  if (!narrator) return null;
  if (media.length === 0) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Text style={styles.header} numberOfLines={1}>
        {narrator.name === narrator.person.name
          ? `Read by ${narrator.name}`
          : `Read as ${narrator.name}`}
      </Text>

      <FlatList
        style={styles.list}
        data={media}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => {
          return <MediaTile style={styles.tile} media={item} />;
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
    gap: 8,
  },
  header: {
    fontSize: 22,
    fontWeight: "500",
    color: Colors.zinc[100],
  },
  list: {
    marginHorizontal: -8,
  },
  tile: {
    padding: 8,
    width: "50%",
    marginBottom: 8,
  },
});
