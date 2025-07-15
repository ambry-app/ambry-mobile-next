import { Delay } from "@/src/components";
import { AuthorScreen } from "@/src/components/screens";
import { useSession } from "@/src/stores/session";
import { RouterParams } from "@/src/types/router";
import { Stack, useLocalSearchParams } from "expo-router";

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
