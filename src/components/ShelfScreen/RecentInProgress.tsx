// FIXME: this was AI written, clean it up
import { PlayerStateTile } from "@/src/components";
import { useRecentInProgressMedia } from "@/src/db/playerStates";
import { usePlayer } from "@/src/stores/player";
import { Session } from "@/src/stores/session";
import { useScreen } from "@/src/stores/screen";
import { router } from "expo-router";
import { FlatList, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import HeaderButton from "../MediaDetailsScreen/HeaderButton";

type RecentInProgressProps = {
  session: Session;
};

export default function RecentInProgress({ session }: RecentInProgressProps) {
  const mediaId = usePlayer((state) => state.mediaId);
  const screenWidth = useScreen((state) => state.screenWidth);
  const { media, opacity } = useRecentInProgressMedia(session, mediaId);

  if (media.length === 0) return null;

  const navigateToAll = () => {
    router.push({
      pathname: "/(app)/(tabs)/(shelf)/in-progress",
    });
  };

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <HeaderButton label="In Progress" onPress={navigateToAll} />
      <FlatList
        style={styles.list}
        showsHorizontalScrollIndicator={false}
        horizontal={true}
        data={media}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PlayerStateTile
            style={[styles.tile, { width: screenWidth / 2.5 }]}
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
  tile: {
    marginRight: 16,
    padding: 8,
  },
});
