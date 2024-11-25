import IconButton from "@/src/components/IconButton";
import { StyleSheet, Text } from "react-native";
import colors from "tailwindcss/colors";

type HeaderButtonProps = {
  label: string;
  onPress: () => void;
};

export default function HeaderButton({ label, onPress }: HeaderButtonProps) {
  return (
    <IconButton
      icon="chevron-right"
      size={16}
      color={colors.zinc[100]}
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
    paddingLeft: 0,
    paddingRight: 16,
  },
  label: {
    fontSize: 22,
    fontWeight: "500",
    color: colors.zinc[100],
  },
});
