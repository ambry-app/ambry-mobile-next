import Grid from "@/src/components/Grid";
import LargeActivityIndicator from "@/src/components/LargeActivityIndicator";
import ScreenCentered from "@/src/components/ScreenCentered";
import { MediaForIndex, listMediaForIndex } from "@/src/db/library";
import { syncDown } from "@/src/db/sync";
import { useSessionStore } from "@/src/stores/session";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Text } from "react-native";

export default function LibraryScreen() {
  const session = useSessionStore((state) => state.session);
  const [media, setMedia] = useState<MediaForIndex[] | undefined>();
  const [error, setError] = useState(false);

  const loadMedia = useCallback(() => {
    listMediaForIndex(session!)
      .then(setMedia)
      .catch((error) => {
        console.error("Failed to load media:", error);
        setError(true);
      });
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      console.log("index focused!");

      // load what's in the DB right now
      loadMedia();

      // sync in background, then load again
      // if network is down, we just ignore the error
      syncDown(session!)
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

  return <Grid media={media} />;
}
