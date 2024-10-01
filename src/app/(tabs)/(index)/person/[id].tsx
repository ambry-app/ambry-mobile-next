import Description from "@/src/components/Description";
import LargeActivityIndicator from "@/src/components/LargeActivityIndicator";
import ScreenCentered from "@/src/components/ScreenCentered";
import { Session, useSession } from "@/src/contexts/session";
import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Thumbnails } from "@/src/db/schema";
import { sync } from "@/src/db/sync";
import { and, eq } from "drizzle-orm";
import { Image } from "expo-image";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";

type Person = {
  id: string;
  name: string;
  thumbnails: Thumbnails | null;
  description: string | null;
};

async function getPerson(
  session: Session,
  personId: string,
): Promise<Person | undefined> {
  return db.query.people.findFirst({
    columns: { id: true, name: true, thumbnails: true, description: true },
    where: and(
      eq(schema.people.url, session!.url),
      eq(schema.people.id, personId),
    ),
  });
}

export default function PersonDetails() {
  const { session } = useSession();
  const { id: personId } = useLocalSearchParams<{ id: string }>();
  const [person, setPerson] = useState<Person | undefined>();
  const [error, setError] = useState(false);

  const loadPerson = useCallback(() => {
    getPerson(session!, personId)
      .then(setPerson)
      .catch((error) => {
        console.error("Failed to load person:", error);
        setError(true);
      });
  }, [session, personId]);

  useFocusEffect(
    useCallback(() => {
      console.log("person/[id] focused!");

      // load what's in the DB right now
      loadPerson();

      // sync in background, then load again
      // if network is down, we just ignore the error
      sync(session!)
        .then(loadPerson)
        .catch((error) => {
          console.error("sync error:", error);
        });

      return () => {
        console.log("person/[id] unfocused");
      };
    }, [loadPerson, session]),
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
          {person.description && (
            <Description description={person.description} />
          )}
        </View>
      </ScrollView>
    </>
  );
}

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
