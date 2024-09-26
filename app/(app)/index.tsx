import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Button, Text, View } from "react-native";
import colors from "tailwindcss/colors";

import { useSession } from "@/contexts/session";
import { db } from "@/db/db";
import * as schema from "@/db/schema";
import { sync } from "@/db/sync";
import { eq } from "drizzle-orm";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect } from "react";

export default function Index() {
  const { session, signOut } = useSession();
  const { data: media } = useLiveQuery(
    db.query.media.findMany({
      columns: { id: true },
      where: eq(schema.media.url, session!.url),
      with: {
        book: {
          columns: { id: true },
          with: {
            bookAuthors: {
              columns: { id: true },
              with: {
                author: {
                  columns: { id: true },
                  with: { person: { columns: { id: true } } },
                },
              },
            },
          },
        },
      },
    }),
  );

  useFocusEffect(
    useCallback(() => {
      console.log("index focused!");
      sync(session!.url, session!.token!);

      return () => {
        console.log("index unfocused");
      };
    }, [session]),
  );

  useEffect(() => {
    console.log("media:", JSON.stringify(media[0], null, 2));
  }, [media]);

  return (
    <View className="flex h-full items-center justify-center">
      <Text className="text-zinc-100 mb-2">Audiobooks: {media.length}</Text>
      <Button
        title="Sign out"
        color={colors.lime[500]}
        onPress={() => {
          // The `app/(app)/_layout.tsx` will redirect to the sign-in screen.
          signOut(session!);
        }}
      />
    </View>
  );
}
