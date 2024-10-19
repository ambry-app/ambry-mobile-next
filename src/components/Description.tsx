import { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Markdown from "react-native-markdown-display";
import colors from "tailwindcss/colors";

export default function Description({ description }: { description: string }) {
  const markdownStyles = StyleSheet.create({
    body: {
      color: colors.zinc[200],
      fontSize: 16,
    },
  });

  const [expanded, setExpanded] = useState(false);

  return (
    <View>
      <View
        className={"relative" + (expanded ? "" : " max-h-32 overflow-hidden")}
      >
        <Markdown style={markdownStyles}>{description}</Markdown>
        {!expanded && (
          <Image
            style={{
              height: 64,
              width: "100%",
              position: "absolute",
              bottom: 0,
            }}
            resizeMode="stretch"
            source={require("../../assets/images/gradient.png")}
          />
        )}
      </View>
      <TouchableOpacity
        onPress={() => {
          setExpanded(!expanded);
        }}
      >
        <Text className="text-zinc-300 text-lg leading-tight text-right">
          {expanded ? "Less" : "More"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
