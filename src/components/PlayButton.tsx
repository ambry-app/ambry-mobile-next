import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { PAUSE_REWIND_SECONDS } from "@/constants";
import * as Player from "@/services/track-player-service";
import { PlayPauseSource, useTrackPlayer } from "@/stores/track-player";
import { useDebounce } from "@/utils/hooks";

import { IconButton } from "./IconButton";
import { Loading } from "./Loading";

function play() {
  Player.play(PlayPauseSource.USER);
}

function pause() {
  Player.pause(PlayPauseSource.USER, PAUSE_REWIND_SECONDS);
}

type PlayButtonProps = {
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  /** Style applied only when showing the play icon (useful for visual centering adjustments) */
  playIconStyle?: StyleProp<ViewStyle>;
};

export function PlayButton(props: PlayButtonProps) {
  const { size, color, style, playIconStyle } = props;
  const { playing, bufferingDuringPlay } = useTrackPlayer(
    (state) => state.isPlaying,
  );
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
  const state = useTrackPlayer((s) => s.state);
  const debouncedState = useDebounce(state, 100);

  if (playing) return "pause";

  if (bufferingDuringPlay) return "spinner";

  switch (debouncedState) {
    case "ready":
      return "play";
    case "buffering":
    case "idle":
      return "spinner";
    case "ended":
      return "circle-check";
  }
}
