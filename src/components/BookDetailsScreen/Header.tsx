import NamesList from "@/src/components/NamesList";
import { BookDetails } from "@/src/db/library";
import { formatPublished } from "@/src/utils/date";
import { StyleSheet, Text, View } from "react-native";
import colors from "tailwindcss/colors";

type HeaderProps = { book: BookDetails };

export default function Header({ book }: HeaderProps) {
  return (
    <View style={styles.container}>
      <View>
        <NamesList
          style={styles.authorsList}
          prefix="By"
          names={book.bookAuthors.map((ba) => ba.author.name)}
        />
        {book.published && (
          <Text style={styles.publishedText}>
            First published{" "}
            {formatPublished(book.published, book.publishedFormat)}
          </Text>
        )}
      </View>
      <Text style={styles.editionsText} numberOfLines={1}>
        Editions
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
    gap: 32,
  },
  authorsList: {
    fontSize: 18,
    fontWeight: 500,
    color: colors.zinc[100],
  },
  publishedText: {
    color: colors.zinc[300],
  },
  editionsText: {
    fontSize: 22,
    fontWeight: 500,
    color: colors.zinc[100],
  },
});
