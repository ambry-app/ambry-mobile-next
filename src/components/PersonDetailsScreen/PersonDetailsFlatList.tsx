import BooksByAuthor from "@/src/components/PersonDetailsScreen/BooksByAuthor";
import Header from "@/src/components/PersonDetailsScreen/Header";
import MediaByNarrator from "@/src/components/PersonDetailsScreen/MediaByNarrator";
import PersonDescription from "@/src/components/PersonDetailsScreen/PersonDescription";
import { usePersonIds } from "@/src/db/library";
import { Session } from "@/src/stores/session";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

type HeaderSection = {
  id: string;
  type: "header";
  personId: string;
};

type PersonDescriptionSection = {
  id: string;
  type: "personDescription";
  personId: string;
};

type BooksByAuthorSection = {
  id: string;
  type: "booksByAuthor";
  authorId: string;
};

type MediaByNarratorSection = {
  id: string;
  type: "mediaByNarrator";
  narratorId: string;
};

type Section =
  | HeaderSection
  | PersonDescriptionSection
  | BooksByAuthorSection
  | MediaByNarratorSection;

function useSections(personId: string, session: Session) {
  const { ids, opacity } = usePersonIds(session, personId);
  const [sections, setSections] = useState<Section[] | undefined>();

  useEffect(() => {
    if (!ids) return;

    const sections: Section[] = [
      { id: `header-${personId}`, type: "header", personId },
      {
        id: `description-${personId}`,
        type: "personDescription",
        personId,
      },
      ...ids.authorIds.map(
        (authorId): BooksByAuthorSection => ({
          id: `books-${authorId}`,
          type: "booksByAuthor",
          authorId,
        }),
      ),
      ...ids.narratorIds.map(
        (narratorId): MediaByNarratorSection => ({
          id: `media-${narratorId}`,
          type: "mediaByNarrator",
          narratorId,
        }),
      ),
    ];
    setSections(sections);
  }, [ids, personId]);

  return { sections, opacity };
}

type PersonDetailsFlatListProps = {
  session: Session;
  personId: string;
};

export default function PersonDetailsFlatList(
  props: PersonDetailsFlatListProps,
) {
  const { personId, session } = props;
  const { sections, opacity } = useSections(personId, session);

  if (!sections) return null;

  return (
    <Animated.FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { opacity }]}
      data={sections}
      keyExtractor={(item) => item.id}
      initialNumToRender={2}
      ListHeaderComponent={<View className="h-4" />}
      ListFooterComponent={<View className="h-4" />}
      renderItem={({ item }) => {
        switch (item.type) {
          case "header":
            return <Header personId={item.personId} session={session} />;
          case "personDescription":
            return (
              <PersonDescription personId={item.personId} session={session} />
            );
          case "booksByAuthor":
            return <BooksByAuthor authorId={item.authorId} session={session} />;
          case "mediaByNarrator":
            return (
              <MediaByNarrator narratorId={item.narratorId} session={session} />
            );
          default:
            // can't happen
            console.error("unknown section type:", item);
            return null;
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
});