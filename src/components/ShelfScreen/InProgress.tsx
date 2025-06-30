import { PlayerStateTile } from "@/src/components";
import { useInProgressMedia } from "@/src/db/playerStates";
import { usePlayer } from "@/src/stores/player";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { FlatList, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { HeaderButton } from "../HeaderButton";

type InProgressProps = {
  session: Session;
  limit?: number;
};

export default function InProgress(props: InProgressProps) {
  const { session, limit } = props;
  const mediaId = usePlayer((state) => state.mediaId);
  const { media, opacity } = useInProgressMedia(session, mediaId);
  const screenWidth = useScreen((state) => state.screenWidth);

  if (media.length === 0) return null;

  const displayMedia = limit ? media.slice(0, limit) : media;

  const navigateToAll = () => {
    router.push({
      pathname: "/(tabs)/(shelf)/in-progress",
    });
  };

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      {limit && <HeaderButton label="Unfinished" onPress={navigateToAll} />}
      <FlatList
        style={styles.list}
        horizontal={limit ? true : false}
        numColumns={limit ? 1 : 2}
        data={displayMedia}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={!limit ? styles.columnWrapper : undefined}
        renderItem={({ item }) => (
          <PlayerStateTile
            style={[
              styles.tile,
              {
                width: limit ? screenWidth / 2.5 : "48%",
                marginRight: limit ? 16 : 0,
              },
            ]}
            media={item}
            session={session}
          />
        )}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    display: "flex",
    gap: 8,
  },
  list: {
    paddingVertical: 8,
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 16,
  },
  tile: {
    padding: 8,
  },
});
