import IconButton from "@/src/components/IconButton";
import { Text } from "react-native";
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
      style={{
        flexDirection: "row-reverse",
        justifyContent: "space-between",
        paddingLeft: 0,
        paddingRight: 16,
      }}
      onPress={onPress}
    >
      <Text className="text-2xl font-medium text-zinc-100" numberOfLines={1}>
        {label}
      </Text>
    </IconButton>
  );
}
