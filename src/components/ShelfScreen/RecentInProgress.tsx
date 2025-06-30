import { PlayerStateTile } from "@/src/components";
import { useInProgressMedia } from "@/src/db/playerStates";
import { usePlayer } from "@/src/stores/player";
import { Session } from "@/src/stores/session";
import { useScreen } from "@/src/stores/screen";
import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import HeaderButton from "../MediaDetailsScreen/HeaderButton";

type RecentInProgressProps = {
  session: Session;
};

export default function RecentInProgress({ session }: RecentInProgressProps) {
  const mediaId = usePlayer((state) => state.mediaId);
  const screenWidth = useScreen((state) => state.screenWidth);
  const { media, opacity } = useInProgressMedia(session, mediaId, 10);

  if (media.length === 0) return null;

  const navigateToAll = () => {
    router.push({
      pathname: "/(tabs)/(shelf)/in-progress",
    });
  };

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.headerContainer}>
        <HeaderButton label="In Progress" onPress={navigateToAll} />
      </View>
      <FlatList
        style={styles.list}
        showsHorizontalScrollIndicator={false}
        horizontal={true}
        data={media}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<View style={styles.listSpacer} />}
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
  container: {},
  headerContainer: {
    paddingHorizontal: 16,
  },
  list: {
    paddingVertical: 8,
  },
  listSpacer: {
    width: 16,
  },
  tile: {
    marginRight: 16,
  },
});
