import Loading from "@/src/components/Loading";
import ScreenCentered from "@/src/components/ScreenCentered";
import { MediaTile } from "@/src/components/Tiles";
import { MediaForIndex, listMediaForIndex } from "@/src/db/library";
import { syncDown } from "@/src/db/sync";
import { useSessionStore } from "@/src/stores/session";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text } from "react-native";
import colors from "tailwindcss/colors";

export default function LibraryScreen() {
  const session = useSessionStore((state) => state.session);
  const [media, setMedia] = useState<MediaForIndex[] | undefined>();
  const [error, setError] = useState(false);

  const loadMedia = useCallback(() => {
    if (!session) return;

    listMediaForIndex(session)
      .then(setMedia)
      .catch((error) => {
        console.error("Failed to load media:", error);
        setError(true);
      });
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      console.log("index focused!");
      if (!session) return;

      // load what's in the DB right now
      loadMedia();

      // sync in background, then load again
      // if network is down, we just ignore the error
      syncDown(session)
        .then(loadMedia)
        .catch((error) => {
          console.error("sync error:", error);
        });

      return () => {
        console.log("index unfocused");
      };
    }, [loadMedia, session]),
  );

  if (media === undefined) {
    return (
      <ScreenCentered>
        <Loading />
      </ScreenCentered>
    );
  }

  if (error) {
    return (
      <ScreenCentered>
        <Text style={styles.error}>Failed to load audiobooks!</Text>
      </ScreenCentered>
    );
  }

  return (
    <FlatList
      style={styles.flatlist}
      data={media}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={({ item }) => <MediaTile style={styles.tile} media={item} />}
    />
  );
}

const styles = StyleSheet.create({
  flatlist: {
    padding: 8,
  },
  tile: {
    padding: 8,
    width: "50%",
    marginBottom: 8,
  },
  error: {
    color: colors.red[500],
  },
});
