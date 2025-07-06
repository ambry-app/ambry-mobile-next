import { PersonTile } from "@/src/components";
import { getMediaAuthorsAndNarrators, MediaHeaderInfo } from "@/src/db/library";
import { useLibraryData } from "@/src/hooks/use-library-data";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { requireValue } from "@/src/utils";
import { FlatList, StyleSheet, View } from "react-native";

type AuthorsAndNarratorsProps = {
  media: MediaHeaderInfo;
  session: Session;
};

export function AuthorsAndNarrators(props: AuthorsAndNarratorsProps) {
  const { media, session } = props;
  const screenWidth = useScreen((state) => state.screenWidth);
  const authorsAndNarrators = useLibraryData(() =>
    getMediaAuthorsAndNarrators(session, media),
  );

  if (!authorsAndNarrators) return null;

  return (
    <View style={styles.container}>
      <FlatList
        style={styles.list}
        data={authorsAndNarrators}
        keyExtractor={(item) => item.id}
        horizontal={true}
        snapToInterval={screenWidth / 2.5 + 16}
        ListHeaderComponent={<View style={styles.listSpacer} />}
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
  listSpacer: {
    width: 16,
  },
});
