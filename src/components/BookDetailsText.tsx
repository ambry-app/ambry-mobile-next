import { StyleProp, StyleSheet, Text, TextStyle } from "react-native";

import { Colors } from "@/styles";

import { NamesList } from "./NamesList";

type BookDetailsTextProps = {
  title: string;
  series?: string[];
  authors?: string[];
  narrators?: string[];
  fullCast?: boolean;
  baseFontSize: number;
  textStyle?: StyleProp<TextStyle>;
  titleWeight?: 500 | 700;
};

export function BookDetailsText(props: BookDetailsTextProps) {
  const {
    title,
    series,
    authors,
    narrators,
    fullCast,
    baseFontSize,
    textStyle,
    titleWeight = 500,
  } = props;
  const authorsFontSize = baseFontSize - 2;
  const narratorsFontSize = baseFontSize - 4;

  return (
    <>
      <Text
        style={[
          { fontWeight: titleWeight, fontSize: baseFontSize },
          styles.title,
          textStyle,
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {series && series.length > 0 && (
        <NamesList
          names={series}
          style={[{ fontSize: baseFontSize }, styles.title, textStyle]}
          numberOfLines={1}
        />
      )}
      {authors && authors.length > 0 && (
        <NamesList
          names={authors}
          style={[{ fontSize: authorsFontSize }, styles.authors, textStyle]}
          numberOfLines={1}
        />
      )}
      {narrators && (narrators.length > 0 || fullCast) && (
        <NamesList
          prefix={narratorsPrefix(narrators, fullCast)}
          names={narrators}
          style={[{ fontSize: narratorsFontSize }, styles.narrators, textStyle]}
          numberOfLines={1}
        />
      )}
    </>
  );
}

function narratorsPrefix(narrators: string[], fullCast?: boolean) {
  if (fullCast) {
    return narrators.length === 0
      ? "Read by a full cast"
      : "Read by a full cast including";
  } else {
    return "Read by";
  }
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
