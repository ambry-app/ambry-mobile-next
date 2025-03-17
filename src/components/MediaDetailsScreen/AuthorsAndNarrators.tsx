import { PersonTile } from "@/src/components";
import { useMediaAuthorsAndNarrators } from "@/src/db/library";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { FlatList, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

type AuthorsAndNarratorsProps = {
  mediaId: string;
  session: Session;
};

export default function AuthorsAndNarrators({
  mediaId,
  session,
}: AuthorsAndNarratorsProps) {
  const screenWidth = useScreen((state) => state.screenWidth);
  const { media, authorSet, narratorSet, opacity } =
    useMediaAuthorsAndNarrators(session, mediaId);

  if (!media) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <FlatList
        style={styles.list}
        showsHorizontalScrollIndicator={false}
        data={[...media.book.bookAuthors, ...media.mediaNarrators]}
        keyExtractor={(item) => item.id}
        horizontal={true}
        ListHeaderComponent={<View style={styles.listSpacer} />}
        renderItem={({ item }) => {
          if ("author" in item) {
            const label = narratorSet.has(item.author.person.id)
              ? "Author & Narrator"
              : "Author";
            return (
              <View style={{ width: screenWidth / 2.5, marginRight: 16 }}>
                <PersonTile
                  label={label}
                  personId={item.author.person.id}
                  name={item.author.name}
                  realName={item.author.person.name}
                  thumbnails={item.author.person.thumbnails}
                />
              </View>
            );
          }

          if ("narrator" in item) {
            // skip if this person is also an author, as they were already rendered
            if (authorSet.has(item.narrator.person.id)) return null;

            return (
              <View style={{ width: screenWidth / 2.5, marginRight: 16 }}>
                <PersonTile
                  label="Narrator"
                  personId={item.narrator.person.id}
                  name={item.narrator.name}
                  realName={item.narrator.person.name}
                  thumbnails={item.narrator.person.thumbnails}
                />
              </View>
            );
          }

          // can't happen:
          console.error("unknown item:", item);
          return null;
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
  },
  header: {
    fontSize: 22,
    fontWeight: "500",
    color: Colors.zinc[100],
    marginBottom: 8,
  },
  list: {
    paddingVertical: 8,
  },
  listSpacer: {
    width: 16,
  },
});
