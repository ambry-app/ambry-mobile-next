import { MediaTile } from "@/src/components/Tiles";
import { useMediaByNarrator } from "@/src/db/library";
import { Session } from "@/src/stores/session";
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
    <Animated.View style={[styles.spacingTop, { opacity }]}>
      <Text
        className="mb-2 text-2xl font-medium text-zinc-100"
        numberOfLines={1}
      >
        {narrator.name === narrator.person.name
          ? `Read by ${narrator.name}`
          : `Read as ${narrator.name}`}
      </Text>

      <FlatList
        className="-mx-2"
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
  spacingTop: {
    marginTop: 32,
  },
  tile: {
    padding: 8,
    width: "50%",
    marginBottom: 8,
  },
});
