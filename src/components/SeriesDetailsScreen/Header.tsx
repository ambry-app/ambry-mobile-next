import NamesList from "@/src/components/NamesList";
import { StyleSheet, View } from "react-native";
import colors from "tailwindcss/colors";
import { AuthorOrNarrator } from "./SeriesDetailsFlatList";

type HeaderProps = {
  authors: AuthorOrNarrator[];
  narrators: AuthorOrNarrator[];
};

export default function Header({ authors, narrators }: HeaderProps) {
  return (
    <View style={styles.container}>
      <NamesList
        names={authors.map((a) => a.name)}
        style={styles.authors}
        prefix="By"
      />
      <NamesList
        names={narrators.map((n) => n.name)}
        style={styles.narrators}
        prefix="Read by"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
    gap: 4,
    marginBottom: 16,
  },
  authors: {
    fontSize: 18,
    fontWeight: "500",
    color: colors.zinc[100],
  },
  narrators: {
    fontSize: 14,
    color: colors.zinc[300],
  },
});
