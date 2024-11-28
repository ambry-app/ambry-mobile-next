import { PersonTile } from "@/src/components/Tiles";
import { useScreen } from "@/src/stores/screen";
import { Colors } from "@/src/styles";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { AuthorOrNarrator } from "./SeriesDetailsFlatList";

type FooterProps = {
  authors: AuthorOrNarrator[];
  narrators: AuthorOrNarrator[];
};

export default function Footer({ authors, narrators }: FooterProps) {
  const screenWidth = useScreen((state) => state.screenWidth);

  return (
    <View style={styles.container}>
      <Text style={styles.header} numberOfLines={1}>
        Author{authors.length > 1 && "s"} & Narrator
        {narrators.length > 1 && "s"}
      </Text>
      <FlatList
        style={styles.list}
        showsHorizontalScrollIndicator={false}
        data={[...authors, ...narrators]}
        keyExtractor={(item) => item.id}
        horizontal={true}
        renderItem={({ item }) => {
          if (item.type === "skip") return null;

          return (
            <PersonTile
              style={[styles.tile, { width: screenWidth / 2.5 }]}
              label={
                item.type === "both"
                  ? "Author & Narrator"
                  : item.type === "author"
                    ? "Author"
                    : "Narrator"
              }
              personId={item.person.id}
              name={item.name}
              realName={item.person.name}
              thumbnails={item.person.thumbnails}
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
    gap: 8,
  },
  header: {
    fontSize: 22,
    fontWeight: "500",
    color: Colors.zinc[100],
  },
  list: {
    paddingVertical: 8,
  },
  tile: {
    marginRight: 16,
  },
});
