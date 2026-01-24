import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";

import { Delay } from "@/components/Delay";
import {
  SolidHeaderBackground,
  useFadingHeader,
} from "@/components/FadingHeader";
import { SeriesScreen } from "@/components/screens/SeriesScreen";
import { useSession } from "@/stores/session";
import { RouterParams } from "@/types/router";

const SCROLL_THRESHOLD = 10;

export default function SeriesRoute() {
  const session = useSession((state) => state.session);
  const { id: seriesId, title } = useLocalSearchParams<RouterParams>();
  const insets = useSafeAreaInsets();
  const { scrollHandler, headerOpacity } = useFadingHeader({
    scrollThreshold: SCROLL_THRESHOLD,
  });

  if (!session) return null;

  // iOS keeps existing header behavior for now
  if (Platform.OS === "ios") {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <Delay delay={10}>
          <SeriesScreen session={session} seriesId={seriesId} />
        </Delay>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerBackground: () => (
            <SolidHeaderBackground
              borderOpacity={headerOpacity}
              height={insets.top + 56}
            />
          ),
        }}
      />
      <Delay delay={10}>
        <SeriesScreen
          session={session}
          seriesId={seriesId}
          scrollHandler={scrollHandler}
        />
      </Delay>
    </>
  );
}
