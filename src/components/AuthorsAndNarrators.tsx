import {
  HORIZONTAL_TILE_SPACING,
  HORIZONTAL_TILE_WIDTH_RATIO,
} from "@/src/constants";
import { MediaAuthorOrNarrator } from "@/src/db/library/shared-queries";
import { useScreen } from "@/src/stores/screen";
import { Colors } from "@/src/styles";
import { requireValue } from "@/src/utils";
import { FlatList, StyleSheet, View } from "react-native";
import { FadeInOnMount } from "./FadeInOnMount";
import { PersonTile } from "./Tiles";

type AuthorsAndNarratorsProps = {
  authorsAndNarrators: MediaAuthorOrNarrator[];
};

export function AuthorsAndNarrators({
  authorsAndNarrators,
}: AuthorsAndNarratorsProps) {
  const screenWidth = useScreen((state) => state.screenWidth);
  const tileSize = screenWidth / HORIZONTAL_TILE_WIDTH_RATIO;

  return (
    <View style={styles.container}>
      <FlatList
        style={styles.list}
        data={authorsAndNarrators}
        keyExtractor={(item) => item.id}
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        snapToInterval={tileSize + HORIZONTAL_TILE_SPACING}
        ListHeaderComponent={<View style={styles.listHeader} />}
        renderItem={({ item }) => {
          const label = labelFromType(item.type);
          // NOTE: we're displaying only the first name, we may be hiding info here
          const name = requireValue(item.names[0], "Name is required");

          return (
            <FadeInOnMount style={[styles.tile, { width: tileSize }]}>
              <PersonTile
                label={label}
                personId={item.id}
                name={name}
                realName={item.realName}
                thumbnails={item.thumbnails}
              />
            </FadeInOnMount>
          );
        }}
      />
    </View>
  );
}

function labelFromType(type: "author" | "narrator" | "authorAndNarrator") {
  switch (type) {
    case "author":
      return "Author";
    case "narrator":
      return "Narrator";
    case "authorAndNarrator":
      return "Author & Narrator";
  }
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
  listHeader: {
    width: 16,
  },
  tile: {
    marginRight: HORIZONTAL_TILE_SPACING,
  },
});
