import { IconButton } from "@/src/components";
import { Colors } from "@/src/styles";
import { StyleSheet, Text } from "react-native";

type HeaderButtonProps = {
  label: string;
  onPress: () => void;
  showCaret?: boolean;
};

export default function HeaderButton({
  label,
  onPress,
  showCaret = true,
}: HeaderButtonProps) {
  return (
    <IconButton
      icon={showCaret ? "chevron-right" : "none"}
      size={16}
      color={Colors.zinc[100]}
      style={styles.button}
      onPress={onPress}
    >
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </IconButton>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingHorizontal: 0,
  },
  label: {
    fontSize: 22,
    fontWeight: "500",
    color: Colors.zinc[100],
  },
});
