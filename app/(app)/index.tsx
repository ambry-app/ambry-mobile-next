import { useLiveQuery } from "drizzle-orm/expo-sqlite";

import Grid from "@/components/Grid";
import { MediaTileMedia } from "@/components/Grid/MediaTile";
import { useSession } from "@/contexts/session";
import { db } from "@/db/db";
import * as schema from "@/db/schema";
import { sync } from "@/db/sync";
import { desc, eq } from "drizzle-orm";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

export default function Index() {
  const { session } = useSession();
  const { data: media } = useLiveQuery(
    db.query.media.findMany({
      columns: { id: true, thumbnails: true },
      where: eq(schema.media.url, session!.url),
      orderBy: desc(schema.media.insertedAt),
      with: {
        book: {
          columns: { id: true, title: true },
          with: {
            bookAuthors: {
              columns: { id: true },
              with: {
                author: {
                  columns: { id: true, name: true },
                  with: { person: { columns: { id: true } } },
                },
              },
            },
            seriesBooks: {
              columns: { id: true, bookNumber: true },
              with: { series: { columns: { id: true, name: true } } },
            },
          },
        },
      },
    }),
  );

  useFocusEffect(
    useCallback(() => {
      console.log("index focused!");

      try {
        sync(session!.url, session!.token!);
      } catch (error) {
        console.error("sync error:", error);
      }

      return () => {
        console.log("index unfocused");
      };
    }, [session]),
  );

  return <Grid media={media as MediaTileMedia[]} />;
}
