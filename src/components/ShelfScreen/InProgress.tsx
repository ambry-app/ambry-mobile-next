import { PlayerStateTile } from "@/src/components";
import { useInProgressMedia } from "@/src/db/playerStates";
import { usePlayer } from "@/src/stores/player";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { FlatList, StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";

type InProgressProps = {
  session: Session;
};

export default function InProgress(props: InProgressProps) {
  const { session } = props;
  const mediaId = usePlayer((state) => state.mediaId);
  const { media, opacity } = useInProgressMedia(session, mediaId);

  if (media.length === 0) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Text style={styles.label} numberOfLines={1}>
        In Progress
      </Text>
      <InProgressFlatList session={session} media={media} />
    </Animated.View>
  );
}

type InProgressFlatListProps = {
  session: Session;
  media: ReturnType<typeof useInProgressMedia>["media"];
};

function InProgressFlatList({ session, media }: InProgressFlatListProps) {
  return (
    <FlatList
      style={styles.list}
      data={media}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={({ item }) => {
        return (
          <PlayerStateTile style={styles.tile} media={item} session={session} />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    display: "flex",
    gap: 8,
  },
  label: {
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
