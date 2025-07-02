import { Delay } from "@/src/components";
import {
  BooksByAuthors,
  Header,
  MediaByNarrators,
} from "@/src/components/person-details";
import { usePullToRefresh } from "@/src/hooks/use-pull-to-refresh";
import { Session } from "@/src/stores/session";
import { useEffect } from "react";
import { LogBox, RefreshControl, ScrollView, StyleSheet } from "react-native";

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
        <MediaByNarrators personId={personId} session={session} />
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
