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

export default function SeriesDetails() {
  const { session } = useSession();
  const { id: seriesId } = useLocalSearchParams<{ id: string }>();
  const { error, data: series } = useLiveQuery(
    db.query.series.findFirst({
      where: and(
        eq(schema.series.url, session!.url),
        eq(schema.series.id, seriesId),
      ),
    }),
  );

  useFocusEffect(
    useCallback(() => {
      console.log("series/[id] focused!");

      try {
        sync(session!.url, session!.token!);
      } catch (error) {
        console.error("sync error:", error);
      }

      return () => {
        console.log("series/[id] unfocused");
      };
    }, [session]),
  );

  if (series === undefined) {
    return (
      <ScreenCentered>
        <LargeActivityIndicator />
      </ScreenCentered>
    );
  }

  if (error) {
    console.error("Failed to load series:", error);

    return (
      <ScreenCentered>
        <Text className="text-red-500">Failed to load series!</Text>
      </ScreenCentered>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: series.name }} />
      <ScrollView></ScrollView>
    </>
  );
}
