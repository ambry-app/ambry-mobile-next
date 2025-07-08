import { seekRelative } from "@/src/stores/player";
import { StyleProp, ViewStyle } from "react-native";
import { IconButton } from "./IconButton";

type SeekButtonProps = {
  icon: string;
  size: number;
  color: string;
  amount: number;
  style?: StyleProp<ViewStyle>;
};

export function SeekButton(props: SeekButtonProps) {
  const { icon, size, color, amount, style } = props;

  return (
    <IconButton
      onPress={() => seekRelative(amount)}
      size={size}
      icon={icon}
      color={color}
      style={style}
    />
  );
}
