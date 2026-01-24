import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";

import { Delay } from "@/components/Delay";
import {
  SolidHeaderBackground,
  useFadingHeader,
} from "@/components/FadingHeader";
import { BookScreen } from "@/components/screens/BookScreen";
import { useSession } from "@/stores/session";
import { RouterParams } from "@/types/router";

const SCROLL_THRESHOLD = 10;

export default function BookRoute() {
  const session = useSession((state) => state.session);
  const { id: bookId, title } = useLocalSearchParams<RouterParams>();
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
          <BookScreen session={session} bookId={bookId} />
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
        <BookScreen
          session={session}
          bookId={bookId}
          scrollHandler={scrollHandler}
        />
      </Delay>
    </>
  );
}
