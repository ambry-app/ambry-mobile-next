import { PersonTile } from "@/src/components";
import { useMediaAuthorsAndNarrators } from "@/src/hooks/library";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { requireValue } from "@/src/utils/require-value";
import { FlatList, StyleSheet, View } from "react-native";
import FadeInOnMount from "../FadeInOnMount";

type AuthorsAndNarratorsProps = {
  mediaId: string;
  session: Session;
};

export default function AuthorsAndNarrators({
  mediaId,
  session,
}: AuthorsAndNarratorsProps) {
  const screenWidth = useScreen((state) => state.screenWidth);
  const { authorsAndNarrators } = useMediaAuthorsAndNarrators(session, mediaId);

  if (!authorsAndNarrators) return null;

  return (
    <FadeInOnMount style={styles.container}>
      <FlatList
        style={styles.list}
        showsHorizontalScrollIndicator={false}
        data={authorsAndNarrators}
        keyExtractor={(item) => item.id}
        horizontal={true}
        ListHeaderComponent={<View style={styles.listSpacer} />}
        snapToInterval={screenWidth / 2.5 + 16}
        renderItem={({ item }) => {
          const label = labelFromType(item.type);
          // NOTE: we're displaying only the first name, we may be hiding info here
          const name = requireValue(item.names[0], "Name is required");

          return (
            <View style={{ width: screenWidth / 2.5, marginRight: 16 }}>
              <PersonTile
                label={label}
                personId={item.id}
                name={name}
                realName={item.realName}
                thumbnails={item.thumbnails}
              />
            </View>
          );
        }}
      />
    </FadeInOnMount>
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
  listSpacer: {
    width: 16,
  },
});
