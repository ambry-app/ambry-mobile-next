import BookDetailsFlatList from "@/src/components/BookDetailsScreen/BookDetailsFlatList";
import useSyncOnFocus from "@/src/hooks/use.sync.on.focus";
import { useSession } from "@/src/stores/session";
import { RouterParams } from "@/src/types/router";
import { Stack, useLocalSearchParams } from "expo-router";

export default function BookDetailsScreen() {
  const session = useSession((state) => state.session);
  const { id: bookId, title } = useLocalSearchParams<RouterParams>();
  useSyncOnFocus();

  if (!session) return null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <BookDetailsFlatList session={session} bookId={bookId} />
    </>
  );
}
