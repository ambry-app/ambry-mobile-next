import { PlayerStateTile, ScreenCentered } from "@/src/components";
import { useInProgressMedia } from "@/src/db/playerStates";
import { syncDown } from "@/src/db/sync";
import { usePlayer } from "@/src/stores/player";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { useCallback, useState } from "react";
import { StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";

type AllInProgressProps = {
  session: Session;
};

export default function AllInProgress({ session }: AllInProgressProps) {
  const mediaId = usePlayer((state) => state.mediaId);
  const { media, opacity } = useInProgressMedia(session, mediaId);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncDown(session);
    } catch (error) {
      console.error("Pull-to-refresh sync error:", error);
    } finally {
      setRefreshing(false);
    }
  }, [session]);

  if (media.length === 0) {
    return (
      <ScreenCentered>
        <Text style={styles.text}>You have no unfinished audiobooks!</Text>
      </ScreenCentered>
    );
  }

  return (
    <Animated.FlatList
      style={[styles.flatlist, { opacity }]}
      numColumns={2}
      data={media}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <PlayerStateTile style={[styles.tile]} media={item} session={session} />
      )}
      onRefresh={onRefresh}
      refreshing={refreshing}
    />
  );
}

const styles = StyleSheet.create({
  text: {
    color: Colors.zinc[100],
  },
  flatlist: {
    padding: 8,
  },
  tile: {
    padding: 8,
    width: "50%",
    marginBottom: 8,
  },
});
