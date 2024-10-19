import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { and, desc, eq } from "drizzle-orm";

export type Person = {
  id: string;
};

export type Author = {
  id: string;
  name: string;
  person: Person;
};

export type BookAuthor = {
  id: string;
  author: Author;
};

export type Series = {
  id: string;
  name: string;
};

export type SeriesBook = {
  id: string;
  bookNumber: string;
  series: Series;
};

export type Book = {
  id: string;
  title: string;
  bookAuthors: BookAuthor[];
  seriesBooks: SeriesBook[];
};

export type Narrator = {
  id: string;
  name: string;
  person: Person;
};

export type MediaNarrator = {
  id: string;
  narrator: Narrator;
};

export type MediaForIndex = {
  id: string;
  thumbnails: schema.Thumbnails | null;
  book: Book;
  mediaNarrators: MediaNarrator[];
  download: Download | null;
};

export type Download = {
  status: string;
  thumbnails: schema.DownloadedThumbnails | null;
};

export type MediaForDetails = {
  id: string;
  description: string | null;
  thumbnails: schema.Thumbnails | null;
  mp4Path: string | null;
  duration: string | null;
  book: Book;
  mediaNarrators: MediaNarrator[];
  download: Download | null;
  published: Date | null;
  publishedFormat: "full" | "year_month" | "year";
  publisher: string | null;
  notes: string | null;
};

export type PersonForDetails = {
  id: string;
  name: string;
  thumbnails: schema.Thumbnails | null;
  description: string | null;
};

export type SeriesForDetails = {
  id: string;
  name: string;
};

export async function listMediaForIndex(
  session: Session,
): Promise<MediaForIndex[]> {
  return db.query.media.findMany({
    columns: { id: true, thumbnails: true },
    where: and(
      eq(schema.media.url, session.url),
      eq(schema.media.status, "ready"),
    ),
    orderBy: desc(schema.media.insertedAt),
    with: {
      download: {
        columns: { status: true, thumbnails: true },
      },
      mediaNarrators: {
        columns: { id: true },
        with: {
          narrator: {
            columns: { id: true, name: true },
            with: { person: { columns: { id: true } } },
          },
        },
      },
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

export async function getMediaForDetails(
  session: Session,
  mediaId: string,
): Promise<MediaForDetails | undefined> {
  return db.query.media.findFirst({
    columns: {
      id: true,
      thumbnails: true,
      description: true,
      mp4Path: true,
      duration: true,
      published: true,
      publishedFormat: true,
      publisher: true,
      notes: true,
    },
    where: and(eq(schema.media.url, session.url), eq(schema.media.id, mediaId)),
    with: {
      download: {
        columns: { status: true, thumbnails: true },
      },
      mediaNarrators: {
        columns: { id: true },
        with: {
          narrator: {
            columns: { id: true, name: true },
            with: { person: { columns: { id: true } } },
          },
        },
      },
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

export async function getPersonForDetails(
  session: Session,
  personId: string,
): Promise<PersonForDetails | undefined> {
  return db.query.people.findFirst({
    columns: { id: true, name: true, thumbnails: true, description: true },
    where: and(
      eq(schema.people.url, session.url),
      eq(schema.people.id, personId),
    ),
  });
}

export async function getSeriesForDetails(
  session: Session,
  seriesId: string,
): Promise<SeriesForDetails | undefined> {
  return db.query.series.findFirst({
    columns: { id: true, name: true },
    where: and(
      eq(schema.series.url, session.url),
      eq(schema.series.id, seriesId),
    ),
  });
}
