import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";

import { Delay } from "@/components/Delay";
import {
  SolidHeaderBackground,
  useFadingHeader,
} from "@/components/FadingHeader";
import { SetScreen } from "@/components/screens/SetScreen";
import { useSession } from "@/stores/session";
import { RouterParams } from "@/types/router";

export default function SetRoute() {
  const session = useSession((state) => state.session);
  const { id: setId, title } = useLocalSearchParams<RouterParams>();
  const insets = useSafeAreaInsets();
  const { scrollHandler, headerOpacity } = useFadingHeader();

  if (!session) return null;

  // iOS keeps existing header behavior for now
  if (Platform.OS === "ios") {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <Delay delay={10}>
          <SetScreen session={session} setId={setId} />
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
        <SetScreen
          session={session}
          setId={setId}
          scrollHandler={scrollHandler}
        />
      </Delay>
    </>
  );
}
