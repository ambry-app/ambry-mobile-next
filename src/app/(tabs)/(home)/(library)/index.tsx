import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack } from "expo-router";

import { Delay } from "@/components/Delay";
import {
  CollapsibleTabHeader,
  HEADER_CONTENT_HEIGHT,
  useCollapsibleHeader,
} from "@/components/FadingHeader";
import { LibraryScreen } from "@/components/screens/LibraryScreen";
import { useSession } from "@/stores/session";

export default function LibraryRoute() {
  const session = useSession((state) => state.session);
  const insets = useSafeAreaInsets();
  const {
    scrollHandler,
    headerTranslateY,
    borderTranslateY,
    borderOpacity,
    contentOpacity,
  } = useCollapsibleHeader({ statusBarHeight: insets.top });

  if (!session) return null;

  // iOS keeps existing header behavior for now
  if (Platform.OS === "ios") {
    return <LibraryScreen session={session} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Delay delay={10}>
        <LibraryScreen
          session={session}
          scrollHandler={scrollHandler}
          topInset={insets.top + HEADER_CONTENT_HEIGHT}
        />
      </Delay>
      <CollapsibleTabHeader
        headerTranslateY={headerTranslateY}
        borderTranslateY={borderTranslateY}
        borderOpacity={borderOpacity}
        contentOpacity={contentOpacity}
        statusBarHeight={insets.top}
      />
    </View>
  );
}
