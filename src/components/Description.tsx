import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Markdown from "react-native-markdown-display";
import colors from "tailwindcss/colors";
import Button from "./Button";

export default function Description({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View>
      <View
        style={[
          styles.container,
          expanded ? styles.containerExpanded : styles.containerCollapsed,
        ]}
      >
        <Markdown style={markdownStyles}>{description}</Markdown>
        {!expanded && (
          <Image
            style={styles.gradient}
            resizeMode="stretch"
            source={require("../../assets/images/gradient.png")}
          />
        )}
      </View>
      <Button
        size={24}
        onPress={() => setExpanded(!expanded)}
        style={{ alignItems: "flex-end", marginTop: expanded ? 0 : -32 }}
      >
        <Text style={styles.moreLess}>{expanded ? "Less" : "More"}</Text>
      </Button>
    </View>
  );
}

const markdownStyles = StyleSheet.create({
  body: {
    color: colors.zinc[100],
    fontSize: 16,
  },
});

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
  },
  containerExpanded: {},
  containerCollapsed: {
    maxHeight: 128,
  },
  gradient: {
    height: 64,
    width: "100%",
    position: "absolute",
    bottom: 0,
  },
  moreLess: {
    color: colors.zinc[300],
    fontSize: 16,
    textAlign: "right",
  },
});
