import { StyleSheet, View } from "react-native";
import TrackPlayer, {
  State,
  usePlaybackState,
} from "react-native-track-player";
import IconButton from "./IconButton";
import Loading from "./Loading";

type PlayButtonProps = {
  size: number;
  color: string;
  padding?: number;
};

export default function PlayButton(props: PlayButtonProps) {
  const { size, color, padding = size / 2 } = props;
  const { state } = usePlaybackState();
  const icon = stateIcon(state);

  if (!state || !icon || icon === "spinner") {
    return (
      <View
        style={[
          styles.container,
          { height: size + padding * 2, width: size + padding * 2 },
        ]}
      >
        <Loading size={size} color={color} />
      </View>
    );
  }

  return (
    <IconButton
      onPress={stateAction(state)}
      size={size}
      icon={icon}
      color={color}
      padding={padding}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
});

function stateIcon(state: State | undefined): string | undefined {
  switch (state) {
    case State.Paused:
    case State.Stopped:
    case State.Ready:
      return "play";
    case State.Buffering:
    case State.Loading:
      return "spinner";
    case State.Playing:
      return "pause";
    case State.None:
      return "question";
    case State.Error:
      return "triangle-exclamation";
    case State.Ended:
      return "circle-check";
  }
  return;
}

function stateAction(state: State | undefined): () => void {
  switch (state) {
    case State.Paused:
    case State.Stopped:
    case State.Ready:
      return () => {
        TrackPlayer.play();
      };
    case State.Playing:
      return () => {
        TrackPlayer.pause();
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
