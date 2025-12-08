import { expandPlayer } from "@/stores/player";

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
