import { FadeInOnMount, MediaTile } from "@/src/components";
import { PersonWithNarratedMedia } from "@/src/db/library";
import { usePersonWithNarratedMedia } from "@/src/hooks/library";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { FlatList, StyleSheet, Text, View } from "react-native";

type MediaByNarratorsProps = {
  personId: string;
  session: Session;
};

export function MediaByNarrators({ personId, session }: MediaByNarratorsProps) {
  const { person } = usePersonWithNarratedMedia(session, personId);

  if (!person) return null;

  return (
    <FadeInOnMount>
      {person.narrators.map((narrator) => (
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
  narrator: PersonWithNarratedMedia["narrators"][0];
  personName: string;
};

function MediaByNarrator({ narrator, personName }: MediaByNarratorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.header} numberOfLines={1}>
        {narrator.name === personName
          ? `Read By ${narrator.name}`
          : `Read As ${narrator.name}`}
      </Text>
      <FlatList
        style={styles.list}
        data={narrator.media}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => {
          return <MediaTile style={styles.tile} media={item} />;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
    gap: 8,
  },
  header: {
    fontSize: 22,
    fontWeight: "500",
    color: Colors.zinc[100],
  },
  list: {
    marginHorizontal: -8,
  },
  tile: {
    padding: 8,
    width: "50%",
    marginBottom: 8,
  },
});
