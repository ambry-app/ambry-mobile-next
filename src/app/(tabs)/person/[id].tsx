import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";

import {
  FadingHeaderBackground,
  FadingHeaderTitle,
  useFadingHeader,
} from "@/components/FadingHeader";
import { PersonScreen } from "@/components/screens/PersonScreen";
import { useSession } from "@/stores/session";
import { RouterParams } from "@/types/router";

export default function PersonRoute() {
  const session = useSession((state) => state.session);
  const { id: personId, title } = useLocalSearchParams<RouterParams>();
  const insets = useSafeAreaInsets();
  const { scrollHandler, headerOpacity } = useFadingHeader();

  if (!session) return null;

  return (
    <>
      <Stack.Screen
        options={{
          title: "",
          headerTransparent: true,
          headerBackground: () => (
            <FadingHeaderBackground
              headerOpacity={headerOpacity}
              height={insets.top + 56}
            />
          ),
          headerTitle: () => (
            <FadingHeaderTitle
              headerOpacity={headerOpacity}
              title={title || ""}
            />
          ),
        }}
      />
      <PersonScreen
        session={session}
        personId={personId}
        scrollHandler={scrollHandler}
      />
    </>
  );
}
