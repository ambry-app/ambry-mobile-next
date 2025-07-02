import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import useFadeInSyncedDataQuery from "@/src/hooks/use-fade-in-synced-data-query";
import { Session } from "@/src/stores/session";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

export function useMediaListByIds(session: Session, mediaIds: string[]) {
  const query = db.query.media.findMany({
    columns: { id: true, thumbnails: true, duration: true },
    where: and(
      eq(schema.media.url, session.url),
      eq(schema.media.status, "ready"),
      inArray(schema.media.id, mediaIds),
    ),
    orderBy: desc(schema.media.insertedAt),
    with: {
      download: {
        columns: { thumbnails: true },
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

  const { data, ...rest } = useFadeInSyncedDataQuery(session, query, [
    mediaIds.join(","),
  ]);

  return { media: data, ...rest };
}

export function useMediaDetails(session: Session, mediaId: string) {
  const query = db.query.media.findFirst({
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
        columns: { thumbnails: true },
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

  const { data, ...rest } = useFadeInSyncedDataQuery(session, query, [mediaId]);

  return { media: data, ...rest };
}

// TODO: break this up into smaller hooks
export function useSeriesDetails(session: Session, seriesId: string) {
  const query = db.query.series.findFirst({
    columns: { id: true, name: true },
    where: and(
      eq(schema.series.url, session.url),
      eq(schema.series.id, seriesId),
    ),
    with: {
      seriesBooks: {
        columns: { id: true, bookNumber: true },
        orderBy: sql`CAST(book_number AS FLOAT)`,
        with: {
          book: {
            columns: { id: true, title: true },
            with: {
              bookAuthors: {
                columns: {},
                with: {
                  author: {
                    columns: { id: true, name: true },
                    with: {
                      person: {
                        columns: { id: true, name: true, thumbnails: true },
                      },
                    },
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
                        columns: { id: true, name: true },
                        with: {
                          person: {
                            columns: {
                              id: true,
                              name: true,
                              thumbnails: true,
                            },
                          },
                        },
                      },
                    },
                  },
                  download: {
                    columns: { thumbnails: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const { data, ...rest } = useFadeInSyncedDataQuery(session, query, [
    seriesId,
  ]);

  return { series: data, ...rest };
}
