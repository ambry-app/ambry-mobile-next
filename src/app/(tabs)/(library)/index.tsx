import Grid from "@/src/components/Grid";
import LargeActivityIndicator from "@/src/components/LargeActivityIndicator";
import ScreenCentered from "@/src/components/ScreenCentered";
import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { sync } from "@/src/db/sync";
import { Session, useSessionStore } from "@/src/stores/session";
import { desc, eq } from "drizzle-orm";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Text } from "react-native";

type Person = {
  id: string;
};

type Author = {
  id: string;
  name: string;
  person: Person;
};

type BookAuthor = {
  id: string;
  author: Author;
};

type Series = {
  id: string;
  name: string;
};

type SeriesBook = {
  id: string;
  bookNumber: string;
  series: Series;
};

type Book = {
  id: string;
  title: string;
  bookAuthors: BookAuthor[];
  seriesBooks: SeriesBook[];
};

export type Media = {
  id: string;
  thumbnails: schema.Thumbnails | null;
  book: Book;
};

async function listMediaForIndex(session: Session): Promise<Media[]> {
  return db.query.media.findMany({
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
  });
}

export default function Index() {
  const session = useSessionStore((state) => state.session);
  const [media, setMedia] = useState<Media[] | undefined>();
  const [error, setError] = useState(false);

  const loadMedia = useCallback(() => {
    listMediaForIndex(session!)
      .then(setMedia)
      .catch((error) => {
        console.error("Failed to load media:", error);
        setError(true);
      });
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      console.log("index focused!");

      // load what's in the DB right now
      loadMedia();

      // sync in background, then load again
      // if network is down, we just ignore the error
      sync(session!)
        .then(loadMedia)
        .catch((error) => {
          console.error("sync error:", error);
        });

      return () => {
        console.log("index unfocused");
      };
    }, [loadMedia, session]),
  );

  if (media === undefined) {
    return (
      <ScreenCentered>
        <LargeActivityIndicator />
      </ScreenCentered>
    );
  }

  if (error) {
    return (
      <ScreenCentered>
        <Text className="text-red-500">Failed to load audiobooks!</Text>
      </ScreenCentered>
    );
  }

  return <Grid media={media} />;
}
