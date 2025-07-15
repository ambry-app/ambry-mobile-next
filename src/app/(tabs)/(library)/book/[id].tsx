import { Delay } from "@/src/components";
import { BookScreen } from "@/src/components/screens";
import { useSession } from "@/src/stores/session";
import { RouterParams } from "@/src/types/router";
import { Stack, useLocalSearchParams } from "expo-router";

export default function BookRoute() {
  const session = useSession((state) => state.session);
  const { id: bookId, title } = useLocalSearchParams<RouterParams>();

  if (!session) return null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Delay delay={10}>
        <BookScreen session={session} bookId={bookId} />
      </Delay>
    </>
  );
}
