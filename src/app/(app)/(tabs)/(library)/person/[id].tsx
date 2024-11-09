import Description from "@/src/components/Description";
import ThumbnailImage from "@/src/components/ThumbnailImage";
import { BookTile, MediaTile } from "@/src/components/Tiles";
import {
  useBooksByAuthor,
  useMediaByNarrator,
  usePersonDescription,
  usePersonHeaderInfo,
  usePersonIds,
} from "@/src/db/library";
import useSyncOnFocus from "@/src/hooks/use.sync.on.focus";
import { Session, useSession } from "@/src/stores/session";
import { RouterParams } from "@/src/types/router";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

export default function PersonDetailsScreen() {
  const session = useSession((state) => state.session);
  const { id: personId, title } = useLocalSearchParams<RouterParams>();
  useSyncOnFocus();

  if (!session) return null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <PersonDetailsFlatList session={session} personId={personId} />
    </>
  );
}

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

function PersonDetailsFlatList(props: PersonDetailsFlatListProps) {
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

type HeaderProps = {
  personId: string;
  session: Session;
};

function Header({ personId, session }: HeaderProps) {
  const { person, opacity } = usePersonHeaderInfo(session, personId);

  if (!person) return null;

  return (
    <Animated.View style={{ opacity }}>
      <ThumbnailImage
        thumbnails={person.thumbnails}
        size="extraLarge"
        style={{
          aspectRatio: 1,
          borderRadius: 9999,
          marginLeft: "auto",
          marginRight: "auto",
          marginTop: 32,
          width: "75%",
        }}
      />
    </Animated.View>
  );
}

type PersonDescriptionProps = {
  personId: string;
  session: Session;
};

function PersonDescription({ personId, session }: PersonDescriptionProps) {
  const { person, opacity } = usePersonDescription(session, personId);

  if (!person?.description) return null;

  return (
    <Animated.View style={[styles.spacingTop, { opacity }]}>
      <Description description={person.description} />
    </Animated.View>
  );
}

type BooksByAuthorProps = {
  authorId: string;
  session: Session;
};

function BooksByAuthor({ authorId, session }: BooksByAuthorProps) {
  const { books, author, opacity } = useBooksByAuthor(session, authorId);

  if (!author) return null;
  if (books.length === 0) return null;

  return (
    <Animated.View style={[styles.spacingTop, { opacity }]}>
      <Text
        className="mb-2 text-2xl font-medium text-zinc-100"
        numberOfLines={1}
      >
        {author.name === author.person.name
          ? `By ${author.name}`
          : `As ${author.name}`}
      </Text>

      <FlatList
        className="-mx-2"
        data={books}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => {
          return <BookTile style={styles.tile} book={item} />;
        }}
      />
    </Animated.View>
  );
}

type MediaByNarratorProps = {
  narratorId: string;
  session: Session;
};

function MediaByNarrator({ narratorId, session }: MediaByNarratorProps) {
  const { media, narrator, opacity } = useMediaByNarrator(session, narratorId);

  if (!narrator) return null;
  if (media.length === 0) return null;

  return (
    <Animated.View style={[styles.spacingTop, { opacity }]}>
      <Text
        className="mb-2 text-2xl font-medium text-zinc-100"
        numberOfLines={1}
      >
        {narrator.name === narrator.person.name
          ? `Read by ${narrator.name}`
          : `Read as ${narrator.name}`}
      </Text>

      <FlatList
        className="-mx-2"
        data={media}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => {
          return <MediaTile style={styles.tile} media={item} />;
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  spacingTop: {
    marginTop: 32,
  },
  tile: {
    padding: 8,
    width: "50%",
    marginBottom: 8,
  },
});
