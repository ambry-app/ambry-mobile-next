import { requestExpandPlayer } from "@/src/stores/player";

type PathArgs = {
  path: string;
  initial: boolean;
};

export function redirectSystemPath({ path }: PathArgs) {
  if (path === "trackplayer://notification.click") {
    requestExpandPlayer();
    return null;
  } else {
    return path;
  }
}
