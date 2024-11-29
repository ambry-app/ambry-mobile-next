import { Scrubber } from "@/src/components";
import { seekTo, usePlayer } from "@/src/stores/player";
import { Colors } from "@/src/styles";
import { useShallow } from "zustand/react/shallow";

export default function PlayerScrubber() {
  const { playbackRate, position, duration, chapterState } = usePlayer(
    useShallow(({ playbackRate, position, duration, chapterState }) => ({
      playbackRate,
      position,
      duration,
      chapterState,
    })),
  );
  const theme = {
    accent: Colors.lime[400],
    strong: Colors.zinc[100],
    emphasized: Colors.zinc[200],
    normal: Colors.zinc[400],
    dimmed: Colors.zinc[500],
    weak: Colors.zinc[800],
  };
  const markers =
    chapterState?.chapters.map((chapter) => chapter.startTime) || [];

  return (
    <Scrubber
      position={position}
      duration={duration}
      playbackRate={playbackRate}
      onChange={(newPosition: number) => seekTo(newPosition)}
      markers={markers}
      theme={theme}
    />
  );
}
