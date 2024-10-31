import { StyleProp, ViewStyle } from "react-native";
import { useTrackPlayerStore } from "../stores/trackPlayer";
import IconButton from "./IconButton";

type SeekButtonProps = {
  icon: string;
  size: number;
  color: string;
  amount: number;
  style?: StyleProp<ViewStyle>;
};

export default function SeekButton(props: SeekButtonProps) {
  const { icon, size, color, amount, style } = props;
  const { seekRelative } = useTrackPlayerStore((state) => state);

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
