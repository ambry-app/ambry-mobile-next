import { StyleSheet, Text, View } from "react-native";

import { AuthorsAndNarrators } from "@/components/AuthorsAndNarrators";
import { MediaAuthorOrNarrator, SetDetails } from "@/services/library-service";
import { Colors } from "@/styles/colors";
import { partsLabel, setLabel } from "@/utils/titles";

type HeaderProps = {
  set: SetDetails;
  partCount: number;
  authorsAndNarrators: MediaAuthorOrNarrator[];
};

export function Header({ set, partCount, authorsAndNarrators }: HeaderProps) {
  return (
    <>
      <View style={styles.container}>
        <Text style={styles.title}>{set.book.title}</Text>
        {setLabel(set) && <Text style={styles.name}>{setLabel(set)}</Text>}
        <Text style={styles.subtitle}>{partsLabel(set, partCount)}</Text>
      </View>
      <AuthorsAndNarrators authorsAndNarrators={authorsAndNarrators} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    color: Colors.zinc[100],
    fontSize: 22,
    fontWeight: "700",
  },
  name: {
    color: Colors.zinc[300],
    fontSize: 16,
    marginTop: 4,
  },
  subtitle: {
    color: Colors.zinc[400],
    fontSize: 14,
    marginTop: 4,
  },
});
