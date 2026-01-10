import { Stack, useLocalSearchParams } from "expo-router";

import { Delay } from "@/components/Delay";
import { BookScreen } from "@/components/screens/BookScreen";
import { useSession } from "@/stores/session";
import { RouterParams } from "@/types/router";

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
