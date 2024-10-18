import Description from "@/src/components/Description";
import LargeActivityIndicator from "@/src/components/LargeActivityIndicator";
import ScreenCentered from "@/src/components/ScreenCentered";
import { PersonForDetails, getPersonForDetails } from "@/src/db/library";
import { Thumbnails } from "@/src/db/schema";
import { syncDown } from "@/src/db/sync";
import { useSessionStore } from "@/src/stores/session";
import { Image } from "expo-image";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";

export default function PersonDetails() {
  const session = useSessionStore((state) => state.session);
  const { id: personId } = useLocalSearchParams<{ id: string }>();
  const [person, setPerson] = useState<PersonForDetails | undefined>();
  const [error, setError] = useState(false);

  const loadPerson = useCallback(() => {
    if (!session) return;

    getPersonForDetails(session, personId)
      .then(setPerson)
      .catch((error) => {
        console.error("Failed to load person:", error);
        setError(true);
      });
  }, [session, personId]);

  useFocusEffect(
    useCallback(() => {
      console.log("person/[id] focused!");
      if (!session) return;

      // load what's in the DB right now
      loadPerson();

      // sync in background, then load again
      // if network is down, we just ignore the error
      syncDown(session)
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
  const session = useSessionStore((state) => state.session);
  if (!session) return null;

  if (!thumbnails) {
    return (
      <View className="mx-12 my-8 rounded-full bg-zinc-900 overflow-hidden">
        <View className="w-full" style={{ aspectRatio: 1 / 1 }} />
      </View>
    );
  }

  const source = {
    uri: `${session.url}/${thumbnails.extraLarge}`,
    headers: { Authorization: `Bearer ${session.token}` },
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
