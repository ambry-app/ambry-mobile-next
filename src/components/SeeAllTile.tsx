import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { Colors } from "@/styles";

import { IconButton } from "./IconButton";

type Props = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function SeeAllTile(props: Props) {
  const { onPress, style } = props;

  return (
    <View style={[styles.tile, style]}>
      <IconButton
        onPress={onPress}
        size={16}
        style={styles.button}
        color={Colors.zinc[100]}
        icon="arrow-right"
      >
        <Text style={styles.text}>See all</Text>
      </IconButton>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    backgroundColor: Colors.zinc[900],
    borderRadius: 999,
    paddingHorizontal: 16,
    flexDirection: "row-reverse",
    gap: 4,
  },
  text: {
    color: Colors.zinc[100],
    fontSize: 14,
  },
});
