import Description from "@/src/components/Description";
import ThumbnailImage from "@/src/components/ThumbnailImage";
import { BookTile, MediaTile } from "@/src/components/Tiles";
import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { useLiveTablesQuery } from "@/src/hooks/use.live.tables.query";
import useSyncOnFocus from "@/src/hooks/use.sync.on.focus";
import { Session, useSessionStore } from "@/src/stores/session";
import { and, desc, eq, inArray } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";

export default function PersonDetails() {
  const session = useSessionStore((state) => state.session);
  const { id: personId, title } = useLocalSearchParams<{
    id: string;
    title: string;
  }>();
  useSyncOnFocus();

  if (!session) return null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <PersonDetailsFlatList session={session} personId={personId} />
    </>
  );
}

type HeaderSection = {
  id: string;
  type: "header";
  personId: string;
};

type PersonDescriptionSection = {
  id: string;
  type: "personDescription";
  personId: string;
};

type BooksByAuthorSection = {
  id: string;
  type: "booksByAuthor";
  authorId: string;
};

type MediaByNarratorSection = {
  id: string;
  type: "mediaByNarrator";
  narratorId: string;
};

type Section =
  | HeaderSection
  | PersonDescriptionSection
  | BooksByAuthorSection
  | MediaByNarratorSection;

function useSections(personId: string, session: Session) {
  const { data: person } = useLiveTablesQuery(
    db.query.people.findFirst({
      columns: {},
      where: and(
        eq(schema.people.url, session.url),
        eq(schema.people.id, personId),
      ),
      with: {
        authors: {
          columns: { id: true },
        },
        narrators: {
          columns: { id: true },
        },
      },
    }),
    ["people", "authors", "narrators"],
  );

  const [sections, setSections] = useState<Section[] | undefined>();

  useEffect(() => {
    if (!person) return;

    const collectedIds = {
      personId,
      authorIds: person.authors.map((a) => a.id),
      narratorIds: person.narrators.map((n) => n.id),
    };

    const sections: Section[] = [
      { id: `header-${personId}`, type: "header", personId },
      {
        id: `description-${personId}`,
        type: "personDescription",
        personId,
      },
      ...collectedIds.authorIds.map(
        (authorId): BooksByAuthorSection => ({
          id: `books-${authorId}`,
          type: "booksByAuthor",
          authorId,
        }),
      ),
      ...collectedIds.narratorIds.map(
        (narratorId): MediaByNarratorSection => ({
          id: `media-${narratorId}`,
          type: "mediaByNarrator",
          narratorId,
        }),
      ),
    ];
    setSections(sections);
  }, [person, personId, session]);

  return sections;
}

function PersonDetailsFlatList({
  session,
  personId,
}: {
  session: Session;
  personId: string;
}) {
  const sections = useSections(personId, session);

  if (!sections) return null;

  return (
    <FlatList
      className="px-4"
      data={sections}
      keyExtractor={(item) => item.id}
      initialNumToRender={2}
      ListHeaderComponent={<View className="h-4" />}
      ListFooterComponent={<View className="h-4" />}
      renderItem={({ item }) => {
        switch (item.type) {
          case "header":
            return <Header personId={item.personId} session={session} />;
          case "personDescription":
            return (
              <PersonDescription personId={item.personId} session={session} />
            );
          case "booksByAuthor":
            return <BooksByAuthor authorId={item.authorId} session={session} />;
          case "mediaByNarrator":
            return (
              <MediaByNarrator narratorId={item.narratorId} session={session} />
            );
          default:
            // can't happen
            console.error("unknown section type:", item);
            return null;
        }
      }}
    />
  );
}

function Header({ personId, session }: { personId: string; session: Session }) {
  const { data: person } = useLiveQuery(
    db.query.people.findFirst({
      columns: {
        name: true,
        thumbnails: true,
      },
      where: and(
        eq(schema.people.url, session.url),
        eq(schema.people.id, personId),
      ),
    }),
  );

  if (!person) return null;

  return (
    <ThumbnailImage
      thumbnails={person.thumbnails}
      size="extraLarge"
      style={{
        aspectRatio: 1,
        borderRadius: 9999,
        marginLeft: "auto",
        marginRight: "auto",
        marginTop: 32,
        width: "75%",
      }}
    />
  );
}

function PersonDescription({
  personId,
  session,
}: {
  personId: string;
  session: Session;
}) {
  const { data: person } = useLiveQuery(
    db.query.people.findFirst({
      columns: {
        description: true,
      },
      where: and(
        eq(schema.people.url, session.url),
        eq(schema.people.id, personId),
      ),
    }),
  );

  if (!person?.description) return null;

  return (
    <View className="mt-8">
      <Description description={person.description} />
    </View>
  );
}

function BooksByAuthor({
  authorId,
  session,
}: {
  authorId: string;
  session: Session;
}) {
  const { data: booksIds } = useLiveQuery(
    db
      .selectDistinct({ id: schema.books.id })
      .from(schema.authors)
      .innerJoin(
        schema.bookAuthors,
        and(
          eq(schema.authors.url, schema.bookAuthors.url),
          eq(schema.authors.id, schema.bookAuthors.authorId),
        ),
      )
      .innerJoin(
        schema.books,
        and(
          eq(schema.bookAuthors.url, schema.books.url),
          eq(schema.bookAuthors.bookId, schema.books.id),
        ),
      )
      .where(
        and(
          eq(schema.authors.url, session.url),
          eq(schema.authors.id, authorId),
        ),
      ),
  );

  const { data: author } = useLiveQuery(
    db.query.authors.findFirst({
      columns: { id: true, name: true },
      where: and(
        eq(schema.authors.url, session.url),
        eq(schema.authors.id, authorId),
      ),
      with: {
        person: {
          columns: { id: true, name: true },
        },
      },
    }),
  );

  const { data: books } = useLiveQuery(
    db.query.books.findMany({
      columns: { id: true, title: true },
      where: and(
        eq(schema.books.url, session.url),
        inArray(
          schema.books.id,
          booksIds.map((book) => book.id),
        ),
      ),
      orderBy: desc(schema.books.published),
      with: {
        bookAuthors: {
          columns: {},
          with: {
            author: {
              columns: { name: true },
            },
          },
        },
        media: {
          columns: { id: true, thumbnails: true },
          with: {
            mediaNarrators: {
              columns: {},
              with: {
                narrator: {
                  columns: { name: true },
                },
              },
            },
            download: {
              columns: { thumbnails: true },
            },
          },
        },
      },
    }),
    [booksIds],
  );

  if (!author) return null;

  if (books.length === 0) return null;

  return (
    <View className="mt-8">
      <Text
        className="mb-2 text-2xl font-medium text-zinc-100"
        numberOfLines={1}
      >
        {author.name === author.person.name
          ? `By ${author.name}`
          : `As ${author.name}`}
      </Text>

      <FlatList
        className="-mx-2"
        data={books}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => {
          return <BookTile className="p-2 w-1/2 mb-2" book={item} />;
        }}
      />
    </View>
  );
}

function MediaByNarrator({
  narratorId,
  session,
}: {
  narratorId: string;
  session: Session;
}) {
  const { data: mediaIds } = useLiveQuery(
    db
      .selectDistinct({ id: schema.media.id })
      .from(schema.narrators)
      .innerJoin(
        schema.mediaNarrators,
        and(
          eq(schema.narrators.url, schema.mediaNarrators.url),
          eq(schema.narrators.id, schema.mediaNarrators.narratorId),
        ),
      )
      .innerJoin(
        schema.media,
        and(
          eq(schema.mediaNarrators.url, schema.media.url),
          eq(schema.mediaNarrators.mediaId, schema.media.id),
        ),
      )
      .innerJoin(
        schema.books,
        and(
          eq(schema.media.url, schema.books.url),
          eq(schema.media.bookId, schema.books.id),
        ),
      )
      .where(
        and(
          eq(schema.narrators.url, session.url),
          eq(schema.narrators.id, narratorId),
        ),
      ),
  );

  const { data: narrator } = useLiveQuery(
    db.query.narrators.findFirst({
      columns: { id: true, name: true },
      where: and(
        eq(schema.narrators.url, session.url),
        eq(schema.narrators.id, narratorId),
      ),
      with: {
        person: {
          columns: { id: true, name: true },
        },
      },
    }),
  );

  const { data: media } = useLiveQuery(
    db.query.media.findMany({
      columns: { id: true, thumbnails: true },
      where: and(
        eq(schema.media.url, session.url),
        inArray(
          schema.media.id,
          mediaIds.map((media) => media.id),
        ),
      ),
      orderBy: desc(schema.media.published),
      with: {
        mediaNarrators: {
          columns: {},
          with: {
            narrator: {
              columns: { name: true },
            },
          },
        },
        download: {
          columns: { thumbnails: true },
        },
        book: {
          columns: { id: true, title: true },
          with: {
            bookAuthors: {
              columns: {},
              with: {
                author: {
                  columns: { name: true },
                },
              },
            },
          },
        },
      },
    }),
    [mediaIds],
  );

  if (!narrator) return null;

  if (media.length === 0) return null;

  return (
    <View className="mt-8">
      <Text
        className="mb-2 text-2xl font-medium text-zinc-100"
        numberOfLines={1}
      >
        {narrator.name === narrator.person.name
          ? `Read by ${narrator.name}`
          : `Read as ${narrator.name}`}
      </Text>

      <FlatList
        className="-mx-2"
        data={media}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => {
          return <MediaTile className="p-2 w-1/2 mb-2" media={item} />;
        }}
      />
    </View>
  );
}
