import { useTrackPlayerStore } from "@/src/stores/trackPlayer";

type PathArgs = {
  path: string;
  initial: boolean;
};

export function redirectSystemPath({ path }: PathArgs) {
  if (path === "trackplayer://notification.click") {
    useTrackPlayerStore.getState().requestExpandPlayer();
    return null;
  } else {
    return path;
  }
}
