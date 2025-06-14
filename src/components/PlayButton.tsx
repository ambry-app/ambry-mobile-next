import { playOrPause, usePlayer } from "@/src/stores/player";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { State } from "@weights-ai/react-native-track-player";
import { useDebounce } from "use-debounce";
import IconButton from "./IconButton";
import Loading from "./Loading";

type PlayButtonProps = {
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
};

export default function PlayButton(props: PlayButtonProps) {
  const { size, color, style } = props;
  const state = usePlayer((state) => state.state);
  const [debouncedState] = useDebounce(state, 100);
  const icon = stateIcon(debouncedState);

  if (!debouncedState || !icon || icon === "spinner") {
    return (
      <View style={[styles.container, { padding: size / 2 }, style]}>
        {/* NOTE: this sizing has to match the sizing of the IconButton component */}
        <View style={[styles.container, { width: size + 1, height: size + 1 }]}>
          <Loading size={size} color={color} />
        </View>
      </View>
    );
  }

  return (
    <IconButton
      onPress={playOrPause}
      size={size}
      icon={icon}
      color={color}
      style={style}
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
