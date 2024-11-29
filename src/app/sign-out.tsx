import { Loading, ScreenCentered } from "@/src/components";
import { tryUnloadPlayer } from "@/src/stores/player";
import { signOut } from "@/src/stores/session";
import { router } from "expo-router";
import { useEffect } from "react";

export default function SignOutScreen() {
  useEffect(() => {
    (async function () {
      await tryUnloadPlayer();
      await signOut();
      router.replace("/sign-in");
    })();
  });

  return (
    <ScreenCentered>
      <Loading />
    </ScreenCentered>
  );
}
