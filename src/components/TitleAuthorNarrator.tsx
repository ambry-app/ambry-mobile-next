import { Colors } from "@/src/styles";
import { StyleSheet, Text } from "react-native";
import NamesList from "./NamesList";

type TitleAuthorsNarratorsProps = {
  title: string;
  authors?: string[];
  narrators?: string[];
  baseFontSize: number;
  titleWeight?: 500 | 700;
};

export default function TitleAuthorsNarrators(
  props: TitleAuthorsNarratorsProps,
) {
  const { title, authors, narrators, baseFontSize, titleWeight = 500 } = props;
  const authorsFontSize = baseFontSize - 2;
  const narratorsFontSize = baseFontSize - 4;

  return (
    <>
      <Text
        style={[
          { fontWeight: titleWeight, fontSize: baseFontSize },
          styles.title,
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {authors && (
        <NamesList
          names={authors}
          style={[{ fontSize: authorsFontSize }, styles.authors]}
          numberOfLines={1}
        />
      )}
      {narrators && (
        <NamesList
          prefix="Read by"
          names={narrators}
          style={[{ fontSize: narratorsFontSize }, styles.narrators]}
          numberOfLines={1}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    color: Colors.zinc[100],
  },
  authors: {
    color: Colors.zinc[300],
  },
  narrators: {
    color: Colors.zinc[400],
  },
});
