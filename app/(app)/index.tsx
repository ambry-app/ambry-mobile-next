import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Button, Text, View } from "react-native";
import colors from "tailwindcss/colors";

import { useSession } from "@/contexts/session";
import { db } from "@/db/db";
import * as schema from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect } from "react";

type PublishedFormat = "FULL" | "YEAR_MONTH" | "YEAR";

interface BookSyncRecord {
  id: string;
  __typename: "Book";
  title: string;
  published: string;
  publishedFormat: PublishedFormat;
  insertedAt: string;
  updatedAt: string;
}

interface PersonSyncRecord {
  id: string;
  __typename: "Person";
  name: string;
  description: string | null;
  imagePath: string | null;
  insertedAt: string;
  updatedAt: string;
}

interface SeriesSyncRecord {
  id: string;
  __typename: "Series";
  name: string;
  insertedAt: string;
  updatedAt: string;
}

interface MediaSyncRecord {
  id: string;
  __typename: "Media";
  book: { id: string };
  published: string | null;
  publishedFormat: PublishedFormat;
  description: string | null;
  imagePath: string | null;
  abridged: boolean;
  fullCast: boolean;
  duration: number | null;
  hlsPath: string | null;
  mp4Path: string | null;
  mpdPath: string | null;
  insertedAt: string;
  updatedAt: string;
}

interface DeletionSyncRecord {
  id: string;
  __typename: "Deletion";
  recordId: string;
  type: string;
  deletedAt: string;
}

type SyncRecord =
  | BookSyncRecord
  | PersonSyncRecord
  | SeriesSyncRecord
  | MediaSyncRecord
  | DeletionSyncRecord;

interface SyncResponse {
  data: {
    sync: SyncRecord[];
  };
}

async function sync(url: string, token: string) {
  console.log("syncing...");

  try {
    const response = await fetch(`${url}/gql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `
          query Sync {
            sync {
              id
              __typename
              ... on Book {
                id
                title
                published
                publishedFormat
                insertedAt
                updatedAt
              }
              ... on Person {
                id
                name
                description
                imagePath
                insertedAt
                updatedAt
              }
              ... on Series {
                id
                name
                insertedAt
                updatedAt
              }
              ... on Media {
                id
                book { id }
                published
                publishedFormat
                description
                imagePath
                abridged
                fullCast
                hlsPath
                mp4Path
                mpdPath
                insertedAt
                updatedAt
              }
              ... on Deletion {
                id
                recordId
                type
                deletedAt
              }
            }
          }
        `,
      }),
    });
    const json: SyncResponse = await response.json();
    // console.log("sync response:", json.data);

    // FIXME: use batch insert
    // FIXME: use transaction
    // FIXME: add other models

    let books: BookSyncRecord[] = [];
    let people: PersonSyncRecord[] = [];
    let series: SeriesSyncRecord[] = [];
    let media: MediaSyncRecord[] = [];
    let deletions: DeletionSyncRecord[] = [];

    for (const record of json.data.sync) {
      switch (record.__typename) {
        case "Book":
          books.push(record);
          break;

        case "Person":
          people.push(record);
          break;

        case "Series":
          series.push(record);
          break;

        case "Media":
          media.push(record);
          break;

        case "Deletion":
          deletions.push(record);
          break;
      }
    }

    // TODO: we could possibly hit SQLite query size or parameter limits
    const peopleValues = people.map((person) => {
      return {
        url: url,
        id: person.id,
        name: person.name,
        description: person.description,
        imagePath: person.imagePath,
        insertedAt: new Date(person.insertedAt),
        updatedAt: new Date(person.updatedAt),
      };
    });

    await db
      .insert(schema.people)
      .values(peopleValues)
      .onConflictDoUpdate({
        target: [schema.people.url, schema.people.id],
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          imagePath: sql`excluded.image_path`,
          updatedAt: sql`excluded.updated_at`,
        },
      });

    // TODO: authors and narrators for the above inserted people

    const booksValues = books.map((book) => {
      return {
        url: url,
        id: book.id,
        title: book.title,
        published: new Date(book.published),
        publishedFormat: book.publishedFormat.toLowerCase() as
          | "full"
          | "year_month"
          | "year",
        insertedAt: new Date(book.insertedAt),
        updatedAt: new Date(book.updatedAt),
      };
    });

    await db
      .insert(schema.books)
      .values(booksValues)
      .onConflictDoUpdate({
        target: [schema.books.url, schema.books.id],
        set: {
          title: sql`excluded.title`,
          published: sql`excluded.published`,
          publishedFormat: sql`excluded.published_format`,
          updatedAt: sql`excluded.updated_at`,
        },
      });

    // TODO: add bookAuthors for the above inserted books

    const seriesValues = series.map((series) => {
      return {
        url: url,
        id: series.id,
        name: series.name,
        insertedAt: new Date(series.insertedAt),
        updatedAt: new Date(series.updatedAt),
      };
    });

    await db
      .insert(schema.series)
      .values(seriesValues)
      .onConflictDoUpdate({
        target: [schema.series.url, schema.series.id],
        set: {
          name: sql`excluded.name`,
          updatedAt: sql`excluded.updated_at`,
        },
      });

    // TODO: add seriesBooks for the above inserted series and books

    const mediaValues = media.map((media) => {
      return {
        url: url,
        id: media.id,
        bookId: media.book.id,
        published: media.published ? new Date(media.published) : null,
        publishedFormat: media.publishedFormat.toLowerCase() as
          | "full"
          | "year_month"
          | "year",
        description: media.description,
        imagePath: media.imagePath,
        abridged: media.abridged,
        fullCast: media.fullCast,
        // TODO:
        // duration: media.duration,
        hlsPath: media.hlsPath,
        mp4Path: media.mp4Path,
        mpdPath: media.mpdPath,
        chapters: [], // Add the chapters property here
        insertedAt: new Date(media.insertedAt),
        updatedAt: new Date(media.updatedAt),
      };
    });

    await db
      .insert(schema.media)
      .values(mediaValues)
      .onConflictDoUpdate({
        target: [schema.media.url, schema.media.id],
        set: {
          bookId: sql`excluded.book_id`,
          published: sql`excluded.published`,
          publishedFormat: sql`excluded.published_format`,
          description: sql`excluded.description`,
          imagePath: sql`excluded.image_path`,
          abridged: sql`excluded.abridged`,
          fullCast: sql`excluded.full_cast`,
          // duration: sql`excluded.duration`,
          hlsPath: sql`excluded.hls_path`,
          mp4Path: sql`excluded.mp4_path`,
          mpdPath: sql`excluded.mpd_path`,
          updatedAt: sql`excluded.updated_at`,
        },
      });

    // TODO: add mediaNarrators for the above inserted media
  } catch (error) {
    console.error("sync error:", error);
  }
}

export default function Index() {
  const { session, signOut } = useSession();
  const { data: books } = useLiveQuery(
    db.query.books.findMany({
      where: eq(schema.books.url, session!.url),
      with: { bookAuthors: { with: { author: true } } },
    }),
  );

  useFocusEffect(
    useCallback(() => {
      console.log("index focused");
      sync(session!.url, session!.token!);

      return () => {
        console.log("index unfocused");
      };
    }, [session]),
  );

  useEffect(() => {
    // console.log("book:", JSON.stringify(books[0], null, 2));
  }, [books]);

  return (
    <View className="flex h-full items-center justify-center">
      <Text className="text-zinc-100 mb-2">Books: {books.length}</Text>
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
