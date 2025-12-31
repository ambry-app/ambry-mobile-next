import { expandPlayer } from "@/services/playback-controls";

type PathArgs = {
  path: string;
  initial: boolean;
};

export function redirectSystemPath({ path }: PathArgs) {
  if (path === "trackplayer://notification.click") {
    expandPlayer();
    return null;
  } else {
    return path;
  }
}
