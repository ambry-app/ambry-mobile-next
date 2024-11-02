import Loading from "@/src/components/Loading";
import ScreenCentered from "@/src/components/ScreenCentered";
import { useSession } from "@/src/stores/session";
import { router } from "expo-router";
import { useEffect } from "react";

export default function SignOutScreen() {
  const signOut = useSession((state) => state.signOut);

  useEffect(() => {
    (async function () {
      await signOut();
      router.navigate("/sign-in");
    })();
  });

  return (
    <ScreenCentered>
      <Loading />
    </ScreenCentered>
  );
}
