import { and, asc, eq } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/types/session";
import { requireValue } from "@/utils/require-value";

import { combineAuthorsAndNarrators } from "./shared-queries";

export async function getSeriesDetails(session: Session, seriesId: string) {
  const series = await getSeries(session, seriesId);
  const authors = await getSeriesAuthors(session, seriesId);
  const narrators = await getSeriesNarrators(session, seriesId);

  const authorsAndNarrators = combineAuthorsAndNarrators(authors, narrators);

  return {
    ...series,
    authorsAndNarrators,
  };
}

async function getSeries(session: Session, seriesId: string) {
  const rows = await getDb()
    .select({
      id: schema.series.id,
      name: schema.series.name,
    })
    .from(schema.series)
    .where(
      and(eq(schema.series.url, session.url), eq(schema.series.id, seriesId)),
    );

  return requireValue(rows[0], `Series with id ${seriesId} not found`);
}

async function getSeriesAuthors(session: Session, seriesId: string) {
  const rows = await getDb()
    .selectDistinct({
      id: schema.authors.id,
      name: schema.authors.name,
      person: {
        id: schema.people.id,
        name: schema.people.name,
        thumbnails: schema.people.thumbnails,
      },
    })
    .from(schema.series)
    .innerJoin(
      schema.seriesBooks,
      and(
        eq(schema.seriesBooks.url, schema.series.url),
        eq(schema.seriesBooks.seriesId, schema.series.id),
      ),
    )
    .innerJoin(
      schema.bookAuthors,
      and(
        eq(schema.bookAuthors.url, schema.seriesBooks.url),
        eq(schema.bookAuthors.bookId, schema.seriesBooks.bookId),
      ),
    )
    .innerJoin(
      schema.authors,
      and(
        eq(schema.authors.url, schema.bookAuthors.url),
        eq(schema.authors.id, schema.bookAuthors.authorId),
      ),
    )
    // A composite byline yields one row per person, which is what we want
    // here: each person earns their own entry in the rail.
    .innerJoin(
      schema.authorPeople,
      and(
        eq(schema.authorPeople.url, schema.authors.url),
        eq(schema.authorPeople.authorId, schema.authors.id),
      ),
    )
    .innerJoin(
      schema.people,
      and(
        eq(schema.people.url, schema.authorPeople.url),
        eq(schema.people.id, schema.authorPeople.personId),
      ),
    )
    .where(
      and(eq(schema.series.url, session.url), eq(schema.series.id, seriesId)),
    )
    .orderBy(asc(schema.bookAuthors.position));

  return rows.map((row) => ({
    ...row,
    type: "author" as const,
  }));
}

async function getSeriesNarrators(session: Session, seriesId: string) {
  const rows = await getDb()
    .selectDistinct({
      id: schema.narrators.id,
      name: schema.narrators.name,
      person: {
        id: schema.people.id,
        name: schema.people.name,
        thumbnails: schema.people.thumbnails,
      },
    })
    .from(schema.series)
    .innerJoin(
      schema.seriesBooks,
      and(
        eq(schema.seriesBooks.url, schema.series.url),
        eq(schema.seriesBooks.seriesId, schema.series.id),
      ),
    )
    .innerJoin(
      schema.media,
      and(
        eq(schema.media.url, schema.seriesBooks.url),
        eq(schema.media.bookId, schema.seriesBooks.bookId),
      ),
    )
    .innerJoin(
      schema.mediaNarrators,
      and(
        eq(schema.mediaNarrators.url, schema.media.url),
        eq(schema.mediaNarrators.mediaId, schema.media.id),
      ),
    )
    .innerJoin(
      schema.narrators,
      and(
        eq(schema.narrators.url, schema.mediaNarrators.url),
        eq(schema.narrators.id, schema.mediaNarrators.narratorId),
      ),
    )
    .innerJoin(
      schema.people,
      and(
        eq(schema.people.url, schema.narrators.url),
        eq(schema.people.id, schema.narrators.personId),
      ),
    )
    .where(
      and(eq(schema.series.url, session.url), eq(schema.series.id, seriesId)),
    )
    .orderBy(asc(schema.mediaNarrators.position));

  return rows.map((row) => ({
    ...row,
    type: "narrator" as const,
  }));
}
