import { Delay } from "@/src/components";
import {
  BooksByAuthors,
  Header,
  MediaByNarrator,
} from "@/src/components/person-details";
import { usePullToRefresh } from "@/src/hooks/use-pull-to-refresh";
import { Session } from "@/src/stores/session";
import { useEffect } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { LogBox } from "react-native";

type PersonDetailsProps = {
  session: Session;
  personId: string;
};

export function PersonDetails(props: PersonDetailsProps) {
  const { session, personId } = props;
  const { refreshing, onRefresh } = usePullToRefresh(session);

  useEffect(() => {
    // Ignore the warning about nested VirtualizedLists, because it works fine in this case.
    LogBox.ignoreLogs(["VirtualizedLists should never be nested"]);
  }, []);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Header personId={personId} session={session} />
      <Delay delay={550}>
        <BooksByAuthors personId={personId} session={session} />
        {/* FIXME: rewrite this component like the one above */}
        {/* {ids.narratorIds.map((narratorId) => (
          <MediaByNarrator
            key={`media-${narratorId}`}
            narratorId={narratorId}
            session={session}
          />
        ))} */}
      </Delay>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  listSpacer: {
    height: 16,
  },
});
