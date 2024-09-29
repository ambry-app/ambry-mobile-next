import { and, eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Image } from "expo-image";
import { Link, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { ScrollView, Text, View } from "react-native";

import LargeActivityIndicator from "@/components/LargeActivityIndicator";
import ScreenCentered from "@/components/ScreenCentered";
import { useSession } from "@/contexts/session";
import { db } from "@/db/db";
import * as schema from "@/db/schema";
import { Thumbnails } from "@/db/schema";
import { sync } from "@/db/sync";

function PersonImage({ thumbnails }: { thumbnails: Thumbnails | null }) {
  const { session } = useSession();

  if (!thumbnails) {
    return (
      <View className="mx-12 my-8 rounded-full bg-zinc-800 overflow-hidden">
        <View className="w-full" style={{ aspectRatio: 1 / 1 }} />
      </View>
    );
  }

  const source = {
    uri: `${session!.url}/${thumbnails.extraLarge}`,
    headers: { Authorization: `Bearer ${session!.token}` },
  };
  const placeholder = { thumbhash: thumbnails.thumbhash };

  return (
    <View className="mx-12 my-8 rounded-full bg-zinc-800 overflow-hidden">
      <Image
        source={source}
        className="w-full"
        style={{ aspectRatio: 1 / 1 }}
        placeholder={placeholder}
        contentFit="cover"
        transition={250}
      />
    </View>
  );
}

export default function PersonDetails() {
  const { session } = useSession();
  const { id: personId } = useLocalSearchParams<{ id: string }>();
  const { error, data: person } = useLiveQuery(
    db.query.people.findFirst({
      where: and(
        eq(schema.people.url, session!.url),
        eq(schema.people.id, personId),
      ),
    }),
  );

  useFocusEffect(
    useCallback(() => {
      console.log("person/[id] focused!");

      try {
        sync(session!.url, session!.token!);
      } catch (error) {
        console.error("sync error:", error);
      }

      return () => {
        console.log("person/[id] unfocused");
      };
    }, [session]),
  );

  if (person === undefined) {
    return (
      <ScreenCentered>
        <LargeActivityIndicator />
      </ScreenCentered>
    );
  }

  if (error) {
    console.error("Failed to load person:", error);

    return (
      <ScreenCentered>
        <Text className="text-red-500">Failed to load person!</Text>
      </ScreenCentered>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: person.name }} />
      <ScrollView>
        <View className="p-4 flex gap-4">
          <PersonImage thumbnails={person.thumbnails} />
          <Text className="text-2xl text-zinc-100 font-bold text-center">
            {person.name}
          </Text>
        </View>
      </ScrollView>
    </>
  );
}
