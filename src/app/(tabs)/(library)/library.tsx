import BookTile from "@/src/components/BookTile";
import LargeActivityIndicator from "@/src/components/LargeActivityIndicator";
import ScreenCentered from "@/src/components/ScreenCentered";
import { MediaForIndex, listMediaForIndex } from "@/src/db/library";
import { syncDown } from "@/src/db/sync";
import { useSessionStore } from "@/src/stores/session";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Text, View } from "react-native";

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
        <LargeActivityIndicator />
      </ScreenCentered>
    );
  }

  if (error) {
    return (
      <ScreenCentered>
        <Text className="text-red-500">Failed to load audiobooks!</Text>
      </ScreenCentered>
    );
  }

  return (
    <FlatList
      className="p-2"
      data={media}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={({ item }) => (
        <BookTile className="p-2 w-1/2 mb-2" media={item} />
      )}
    />
  );
}
