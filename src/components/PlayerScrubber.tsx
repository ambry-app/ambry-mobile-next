import TrackPlayer from "react-native-track-player";
import colors from "tailwindcss/colors";
import { usePlayer } from "../stores/player";
import Scrubber from "./Scrubber";

export default function PlayerScrubber() {
  const { playbackRate, position, duration, chapterState } = usePlayer(
    (state) => state,
  );
  const theme = {
    accent: colors.lime[400],
    strong: colors.gray[100],
    emphasized: colors.gray[200],
    normal: colors.gray[400],
    dimmed: colors.gray[500],
    weak: colors.gray[800],
  };
  const markers =
    chapterState?.chapters.map((chapter) => chapter.startTime) || [];

  return (
    <Scrubber
      position={position}
      duration={duration}
      playbackRate={playbackRate}
      onChange={(newPosition: number) => TrackPlayer.seekTo(newPosition)}
      markers={markers}
      theme={theme}
    />
  );
}
