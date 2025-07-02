import { NamesList } from "@/src/components";
import { BookDetails } from "@/src/db/library";
import { Colors } from "@/src/styles";
import { formatPublished } from "@/src/utils";
import { StyleSheet, Text, View } from "react-native";

type HeaderProps = { book: BookDetails };

export function Header({ book }: HeaderProps) {
  return (
    <View style={styles.container}>
      <View>
        <NamesList
          style={styles.authorsList}
          prefix="By"
          names={book.authors.map((author) => author.name)}
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
    color: Colors.zinc[100],
  },
  publishedText: {
    color: Colors.zinc[300],
  },
  editionsText: {
    fontSize: 22,
    fontWeight: 500,
    color: Colors.zinc[100],
  },
});
