import { Stack, useLocalSearchParams } from "expo-router";

import { Delay } from "@/components/Delay";
import { AuthorScreen } from "@/components/screens/AuthorScreen";
import { useSession } from "@/stores/session";
import { RouterParams } from "@/types/router";

export default function AuthorRoute() {
  const session = useSession((state) => state.session);
  const { id: authorId, title } = useLocalSearchParams<RouterParams>();

  if (!session) return null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Delay delay={10}>
        <AuthorScreen session={session} authorId={authorId} />
      </Delay>
    </>
  );
}
