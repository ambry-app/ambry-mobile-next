import Loading from "@/src/components/Loading";
import ScreenCentered from "@/src/components/ScreenCentered";
import { unloadPlayer } from "@/src/stores/player";
import { signOut } from "@/src/stores/session";
import { router } from "expo-router";
import { useEffect } from "react";

export default function SignOutScreen() {
  useEffect(() => {
    (async function () {
      await unloadPlayer();
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
