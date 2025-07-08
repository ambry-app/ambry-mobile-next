import { Delay, FadeInOnMount } from "@/src/components";
import {
  BooksByAuthors,
  Header,
  MediaByNarrators,
} from "@/src/components/screens/person-details";
import { getPersonHeaderInfo } from "@/src/db/library";
import { useLibraryData } from "@/src/hooks/use-library-data";
import { usePullToRefresh } from "@/src/hooks/use-pull-to-refresh";
import { Session } from "@/src/stores/session";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";

type PersonDetailsProps = {
  session: Session;
  personId: string;
};

export function PersonDetails(props: PersonDetailsProps) {
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
