import { RefreshControl, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Delay } from "@/components/Delay";
import { FadeInOnMount } from "@/components/FadeInOnMount";
import { ScrollHandler } from "@/components/FadingHeader";
import { BooksByAuthors } from "@/components/screens/person-screen/BooksByAuthors";
import { Header } from "@/components/screens/person-screen/Header";
import { MediaByNarrators } from "@/components/screens/person-screen/MediaByNarrators";
import {
  getPersonHeaderInfo,
  useLibraryData,
} from "@/services/library-service";
import { usePullToRefresh } from "@/services/sync-service";
import { Session } from "@/types/session";

type PersonScreenProps = {
  session: Session;
  personId: string;
  scrollHandler: ScrollHandler;
};

export function PersonScreen(props: PersonScreenProps) {
  const { session, personId, scrollHandler } = props;
  const { refreshing, onRefresh } = usePullToRefresh(session);
  const person = useLibraryData(() => getPersonHeaderInfo(session, personId));
  const insets = useSafeAreaInsets();

  if (!person) return null;

  return (
    <View style={styles.screenContainer}>
      <Animated.ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <FadeInOnMount>
          <Header person={person} />
        </FadeInOnMount>
        <Delay delay={100}>
          {person.authors.length > 0 && (
            <BooksByAuthors person={person} session={session} />
          )}
          {person.narrators.length > 0 && (
            <MediaByNarrators person={person} session={session} />
          )}
        </Delay>
      </Animated.ScrollView>

      {/* <StatusBarOverlay height={insets.top} /> */}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: "black",
  },
  container: {
    paddingBottom: 16,
  },
});
