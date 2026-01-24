import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack } from "expo-router";

import { Delay } from "@/components/Delay";
import {
  SolidHeaderBackground,
  useFadingHeader,
} from "@/components/FadingHeader";
import { InProgressScreen } from "@/components/screens/InProgressScreen";
import { useSession } from "@/stores/session";

const SCROLL_THRESHOLD = 10;

export default function InProgressRoute() {
  const session = useSession((state) => state.session);
  const insets = useSafeAreaInsets();
  const { scrollHandler, headerOpacity } = useFadingHeader({
    scrollThreshold: SCROLL_THRESHOLD,
  });

  if (!session) return null;

  // iOS keeps existing header behavior for now
  if (Platform.OS === "ios") {
    return (
      <Delay delay={10}>
        <InProgressScreen session={session} />
      </Delay>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerBackground: () => (
            <SolidHeaderBackground
              borderOpacity={headerOpacity}
              height={insets.top + 56}
            />
          ),
        }}
      />
      <Delay delay={10}>
        <InProgressScreen session={session} scrollHandler={scrollHandler} />
      </Delay>
    </>
  );
}
