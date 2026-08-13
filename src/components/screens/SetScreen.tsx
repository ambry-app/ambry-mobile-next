import { StyleSheet } from "react-native";
import Animated from "react-native-reanimated";

import { FadeInOnMount } from "@/components/FadeInOnMount";
import { ScrollHandler } from "@/components/FadingHeader";
import { MediaTile } from "@/components/Tiles";
import {
  getSetDetails,
  getSetParts,
  useLibraryData,
} from "@/services/library-service";
import { usePullToRefresh } from "@/services/sync-service";
import { Session } from "@/types/session";
import { partLabel } from "@/utils/titles";

import { Header } from "./set-screen/Header";

type SetScreenProps = {
  setId: string;
  session: Session;
  scrollHandler?: ScrollHandler;
};

export function SetScreen({ setId, session, scrollHandler }: SetScreenProps) {
  const set = useLibraryData(() => getSetDetails(session, setId));
  const parts = useLibraryData(() => getSetParts(session, setId));
  const { refreshing, onRefresh } = usePullToRefresh(session);

  if (!set || !parts) return null;

  return (
    <Animated.FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={styles.flatlist}
      showsVerticalScrollIndicator={false}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      data={parts}
      keyExtractor={(item) => item.id}
      numColumns={2}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListHeaderComponent={() => (
        <FadeInOnMount>
          <Header
            set={set}
            partCount={parts.length}
            authorsAndNarrators={set.authorsAndNarrators}
          />
        </FadeInOnMount>
      )}
      renderItem={({ item }) => (
        <FadeInOnMount style={styles.tile}>
          {/*
            Every part shares the book's title, so the part is what tells them
            apart. A part with its own title keeps it. The total is already in
            the header, so tiles stop at "Part 2".
          */}
          <MediaTile
            media={{
              ...item,
              title:
                item.title ??
                partLabel(item.partNumber, set, { includeTotal: false }),
              book: { ...item.book, authors: [] },
            }}
          />
        </FadeInOnMount>
      )}
    />
  );
}

const styles = StyleSheet.create({
  flatlist: {
    padding: 8,
  },
  tile: {
    padding: 8,
    width: "50%",
    marginBottom: 8,
  },
});
