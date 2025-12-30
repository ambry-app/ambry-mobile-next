import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { useDebounce } from "@/hooks/use-debounce";
import {
  State,
  useIsPlaying,
  usePlaybackState,
} from "@/services/trackplayer-wrapper";
import { pause, play } from "@/stores/player";

import { IconButton } from "./IconButton";
import { Loading } from "./Loading";

type PlayButtonProps = {
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  /** Style applied only when showing the play icon (useful for visual centering adjustments) */
  playIconStyle?: StyleProp<ViewStyle>;
};

export function PlayButton(props: PlayButtonProps) {
  const { size, color, style, playIconStyle } = props;
  const { playing, bufferingDuringPlay } = useIsPlaying();
  const icon = useStateIcon(playing, bufferingDuringPlay);
  const iconStyle = icon === "play" ? playIconStyle : undefined;

  if (!icon || icon === "spinner") {
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
      onPress={playing ? pause : play}
      size={size}
      icon={icon}
      color={color}
      style={style}
      iconStyle={iconStyle}
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

function useStateIcon(
  playing: boolean | undefined,
  bufferingDuringPlay: boolean | undefined,
) {
  const { state } = usePlaybackState();
  const debouncedState = useDebounce(state, 100);

  if (playing) return "pause";

  if (bufferingDuringPlay) return "spinner";

  switch (debouncedState) {
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
