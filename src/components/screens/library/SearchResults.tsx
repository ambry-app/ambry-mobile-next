import { FadeInOnMount, MediaTile } from "@/src/components";
import { PAGE_SIZE } from "@/src/constants";
import { getSearchedMedia } from "@/src/db/library";
import { useLibraryData } from "@/src/hooks/use-library-data";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { FlatList, StyleSheet, Text } from "react-native";

type SearchResultsProps = {
  session: Session;
  searchQuery: string;
};

export function SearchResults(props: SearchResultsProps) {
  const { session, searchQuery } = props;
  const media = useLibraryData(
    () => getSearchedMedia(session, PAGE_SIZE, searchQuery),
    [searchQuery],
  );

  if (!media) {
    return null;
  }

  if (media.length === 0) {
    return (
      <Text style={styles.text}>
        Nothing in the library matches your search term. Please try another
        search.
      </Text>
    );
  }

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={styles.flatlist}
      data={media}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={({ item }) => (
        <FadeInOnMount style={styles.tile}>
          <MediaTile media={item} />
        </FadeInOnMount>
      )}
    />
  );
}

const styles = StyleSheet.create({
  text: {
    color: Colors.zinc[100],
    paddingHorizontal: 32,
    paddingTop: 32,
  },
  flatlist: {
    padding: 8,
  },
  tile: {
    padding: 8,
    width: "50%",
    marginBottom: 8,
  },
});
