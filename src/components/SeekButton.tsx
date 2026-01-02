import { StyleProp, ViewStyle } from "react-native";

import { seekRelative } from "@/services/seek-service";
import { SeekSource } from "@/stores/player-ui-state";

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
      onPress={() => seekRelative(amount, SeekSource.BUTTON)}
      size={size}
      icon={icon}
      color={color}
      style={style}
    />
  );
}
