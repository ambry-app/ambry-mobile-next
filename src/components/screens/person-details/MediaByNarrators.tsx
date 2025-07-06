import {
  FadeInOnMount,
  HeaderButton,
  MediaTile,
  SeeAllTile,
} from "@/src/components";
import {
  getMediaByNarrators,
  MediaByNarratorsType,
  PersonHeaderInfo,
} from "@/src/db/library";
import { useLibraryData } from "@/src/hooks/use-library-data";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";

const LIMIT = 10;

type MediaByNarratorsProps = {
  person: PersonHeaderInfo;
  session: Session;
};

export function MediaByNarrators(props: MediaByNarratorsProps) {
  const { person, session } = props;
  const narrators = useLibraryData(() =>
    getMediaByNarrators(session, person.narrators, LIMIT),
  );

  if (!narrators) return null;

  return (
    <FadeInOnMount>
      {narrators.map((narrator) => (
        <MediaByNarrator
          key={`media-${narrator.id}`}
          narrator={narrator}
          personName={person.name}
        />
      ))}
    </FadeInOnMount>
  );
}

type MediaByNarratorProps = {
  narrator: MediaByNarratorsType[number];
  personName: string;
};

function MediaByNarrator(props: MediaByNarratorProps) {
  const { narrator, personName } = props;
  const screenWidth = useScreen((state) => state.screenWidth);

  if (narrator.media.length === 0) return null;

  const navigateToNarrator = () => {
    router.navigate({
      pathname: "/person/[id]",
      params: { id: narrator.id, title: narrator.name },
    });
  };

  const hasMore = narrator.media.length === LIMIT;

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <HeaderButton
          label={
            narrator.name === personName
              ? `Read By ${narrator.name}`
              : `Read As ${narrator.name}`
          }
          onPress={navigateToNarrator}
          showCaret={hasMore}
        />
      </View>

      <FlatList
        style={styles.list}
        data={narrator.media}
        keyExtractor={(item) => item.id}
        horizontal={true}
        snapToInterval={screenWidth / 2.5 + 16}
        ListHeaderComponent={<View style={styles.listSpacer} />}
        ListFooterComponent={
          hasMore ? (
            <SeeAllTile
              onPress={navigateToNarrator}
              style={{ width: screenWidth / 2.5, height: screenWidth / 2.5 }}
            />
          ) : null
        }
        renderItem={({ item }) => {
          return (
            <MediaTile
              style={[styles.tile, { width: screenWidth / 2.5 }]}
              media={item}
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
  },
  headerContainer: {
    paddingHorizontal: 16,
  },
  list: {
    paddingVertical: 8,
  },
  listSpacer: {
    width: 16,
  },
  tile: {
    marginRight: 16,
  },
});
