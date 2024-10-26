import TrackPlayer, {
  State,
  usePlaybackState,
} from "react-native-track-player";
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
  const { state } = usePlaybackState();

  return (
    <IconButton
      onPress={stateAction(state, amount)}
      size={size}
      icon={icon}
      color={color}
      padding={padding}
    />
  );
}

function stateAction(state: State | undefined, amount: number): () => void {
  switch (state) {
    case State.Paused:
    case State.Stopped:
    case State.Ready:
    case State.Playing:
      return async () => {
        const { position } = await TrackPlayer.getProgress();
        const playbackRate = await TrackPlayer.getRate();
        const newPosition = position + amount * playbackRate;
        TrackPlayer.seekTo(newPosition);
      };
    case State.Buffering:
    case State.Loading:
    case State.None:
    case State.Error:
    case State.Ended:
      return () => {};
  }
  return () => {};
}
