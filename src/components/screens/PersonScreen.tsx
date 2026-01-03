import { RefreshControl, ScrollView, StyleSheet } from "react-native";

import { Delay, FadeInOnMount } from "@/components";
import {
  BooksByAuthors,
  Header,
  MediaByNarrators,
} from "@/components/screens/person-screen";
import { getPersonHeaderInfo } from "@/db/library";
import { useLibraryData } from "@/hooks/use-library-data";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Session } from "@/types/session";

type PersonScreenProps = {
  session: Session;
  personId: string;
};

export function PersonScreen(props: PersonScreenProps) {
  const { session, personId } = props;
  const { refreshing, onRefresh } = usePullToRefresh(session);
  const person = useLibraryData(() => getPersonHeaderInfo(session, personId));

  if (!person) return null;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
});
