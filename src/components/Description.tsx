import { StyleSheet } from "react-native";
import Markdown from "react-native-markdown-display";
import colors from "tailwindcss/colors";

export default function Description({ description }: { description: string }) {
  const markdownStyles = StyleSheet.create({
    body: {
      color: colors.zinc[200],
      fontSize: 18,
    },
  });

  return <Markdown style={markdownStyles}>{description}</Markdown>;
}
