import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";

import {
  FadingHeaderBackground,
  FadingHeaderTitle,
  useFadingHeader,
} from "@/components/FadingHeader";
import { MediaScreen } from "@/components/screens/MediaScreen";
import { getMediaTitle, useLibraryData } from "@/services/library-service";
import { useSession } from "@/stores/session";
import { RouterParams } from "@/types/router";

// Scroll threshold where header fades in/out
const SCROLL_THRESHOLD = 400;

export default function MediaRoute() {
  const session = useSession((state) => state.session);
  const { id: mediaId, title: paramTitle } =
    useLocalSearchParams<RouterParams>();
  const insets = useSafeAreaInsets();
  const { scrollHandler, headerOpacity } = useFadingHeader({
    scrollThreshold: SCROLL_THRESHOLD,
  });

  // Only fetch title if not provided via params (e.g., deep links)
  const fetchedTitle = useLibraryData(
    async () =>
      !paramTitle && session ? getMediaTitle(session, mediaId) : null,
    [paramTitle, session, mediaId],
  );

  // Use param title if available, otherwise fall back to fetched title
  const title = paramTitle || fetchedTitle || "";

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
            <FadingHeaderTitle headerOpacity={headerOpacity} title={title} />
          ),
        }}
      />
      <MediaScreen
        session={session}
        mediaId={mediaId}
        scrollHandler={scrollHandler}
      />
    </>
  );
}
