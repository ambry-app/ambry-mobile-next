import { useTrackPlayerStore } from "../stores/trackPlayer";
import IconButton from "./IconButton";

type SeekButtonProps = {
  icon: string;
  size: number;
  color: string;
  amount: number;
  padding?: number;
};

export default function SeekButton(props: SeekButtonProps) {
  const { icon, size, color, amount, padding = size / 2 } = props;
  const { seekRelative } = useTrackPlayerStore((state) => state);

  return (
    <IconButton
      onPress={() => seekRelative(amount)}
      size={size}
      icon={icon}
      color={color}
      padding={padding}
    />
  );
}
