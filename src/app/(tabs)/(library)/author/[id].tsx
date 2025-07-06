import { Delay } from "@/src/components";
import { AuthorDetails } from "@/src/components/screens";
import { useSession } from "@/src/stores/session";
import { RouterParams } from "@/src/types/router";
import { Stack, useLocalSearchParams } from "expo-router";

export default function AuthorScreen() {
  const session = useSession((state) => state.session);
  const { id: authorId, title } = useLocalSearchParams<RouterParams>();

  if (!session) return null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Delay delay={10}>
        <AuthorDetails session={session} authorId={authorId} />
      </Delay>
    </>
  );
}
