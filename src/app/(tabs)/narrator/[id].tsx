import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";

import { Delay } from "@/components/Delay";
import {
  SolidHeaderBackground,
  useFadingHeader,
} from "@/components/FadingHeader";
import { NarratorScreen } from "@/components/screens/NarratorScreen";
import { ThumbnailImage } from "@/components/ThumbnailImage";
import {
  getNarratorHeaderInfo,
  useLibraryData,
} from "@/services/library-service";
import { useSession } from "@/stores/session";
import { Colors } from "@/styles/colors";
import { RouterParams } from "@/types/router";

// Show border after minimal scroll
const SCROLL_THRESHOLD = 10;

export default function NarratorRoute() {
  const session = useSession((state) => state.session);
  const { id: narratorId } = useLocalSearchParams<RouterParams>();
  const insets = useSafeAreaInsets();
  const { scrollHandler, headerOpacity } = useFadingHeader({
    scrollThreshold: SCROLL_THRESHOLD,
  });

  // Fetch narrator data for the header - session is checked after hooks
  const narrator = useLibraryData(
    async () => (session ? getNarratorHeaderInfo(session, narratorId) : null),
    [session, narratorId],
  );

  if (!session) return null;

  return (
    <>
      <Stack.Screen
        options={{
          title: "",
          headerBackground: () => (
            <SolidHeaderBackground
              borderOpacity={headerOpacity}
              height={insets.top + 56}
            />
          ),
          headerTitle: () =>
            narrator ? (
              <View style={styles.headerTitleContainer}>
                <ThumbnailImage
                  thumbnails={narrator.person.thumbnails}
                  size="small"
                  style={styles.headerThumbnail}
                />
                <View style={styles.headerTextContainer}>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    Read by{" "}
                    {narrator.name !== narrator.person.name
                      ? narrator.person.name
                      : narrator.name}
                  </Text>
                  {narrator.name !== narrator.person.name && (
                    <Text style={styles.headerSubtitle} numberOfLines={1}>
                      as {narrator.name}
                    </Text>
                  )}
                </View>
              </View>
            ) : null,
        }}
      />
      <Delay delay={10}>
        <NarratorScreen
          session={session}
          narratorId={narratorId}
          narrator={narrator ?? null}
          scrollHandler={scrollHandler}
        />
      </Delay>
    </>
  );
}

const styles = StyleSheet.create({
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerThumbnail: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  headerTextContainer: {
    flexDirection: "column",
  },
  headerTitle: {
    color: Colors.zinc[100],
    fontSize: 16,
    fontWeight: "600",
  },
  headerSubtitle: {
    color: Colors.zinc[400],
    fontSize: 12,
  },
});
