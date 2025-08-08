import { Scrubber } from "@/src/components";
import { seekTo, usePlayer } from "@/src/stores/player";
import { Colors } from "@/src/styles";
import { useShallow } from "zustand/shallow";

export function PlayerScrubber() {
  const { playbackRate, position, duration, chapters } = usePlayer(
    useShallow(({ playbackRate, position, duration, chapters }) => ({
      playbackRate,
      position,
      duration,
      chapters,
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
  const markers = chapters?.map((chapter) => chapter.startTime) || [];

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
