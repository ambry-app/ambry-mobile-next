import { useTrackPlayerStore } from "@/src/stores/trackPlayer";
import colors from "tailwindcss/colors";
import Scrubber from "./Scrubber";

export default function PlayerScrubber() {
  const { position, duration } = useTrackPlayerStore((state) => state);
  const theme = {
    accent: colors.lime[400],
    strong: colors.gray[100],
    emphasized: colors.gray[200],
    normal: colors.gray[400],
    dimmed: colors.gray[500],
    weak: colors.gray[800],
  };

  return (
    <Scrubber
      position={position}
      duration={duration}
      playbackRate={1}
      onChange={(newPosition: number) =>
        console.log("TODO: seekTo", newPosition)
      }
      markers={[]}
      theme={theme}
    />
  );
}
