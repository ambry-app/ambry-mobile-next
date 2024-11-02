import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { useEffect, useState } from "react";
import { useSharedValue, withTiming } from "react-native-reanimated";
import useFadeInQuery from "../hooks/use.fade.in.query";
import { useLiveTablesQuery } from "../hooks/use.live.tables.query";

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

export type BookDetails = {
  title: string;
  published: Date;
  publishedFormat: "full" | "year_month" | "year";
  bookAuthors: {
    author: {
      id: string;
      name: string;
      person: {
        id: string;
        name: string;
        thumbnails: schema.Thumbnails | null;
      };
    };
  }[];
  media: {
    id: string;
    thumbnails: schema.Thumbnails | null;
    mediaNarrators: {
      narrator: {
        id: string;
        name: string;
        person: {
          id: string;
          name: string;
          thumbnails: schema.Thumbnails | null;
        };
      };
    }[];
    download: {
      thumbnails: schema.DownloadedThumbnails | null;
    } | null;
  }[];
};

export function useBookDetails(session: Session, bookId: string) {
  const query = db.query.books.findFirst({
    columns: {
      id: true,
      title: true,
      published: true,
      publishedFormat: true,
    },
    where: and(eq(schema.books.url, session.url), eq(schema.books.id, bookId)),
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
  });

  return useFadeInQuery(
    query,
    [
      "books",
      "book_authors",
      "authors",
      "people",
      "media",
      "media_narrators",
      "narrators",
      "downloads",
    ],
    [bookId],
  );
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

  return useFadeInQuery(
    query,
    [
      "series",
      "series_books",
      "books",
      "book_authors",
      "authors",
      "people",
      "media",
      "media_narrators",
      "narrators",
      "downloads",
    ],
    [seriesId],
  );
}

export function usePersonIds(session: Session, personId: string) {
  const query = db.query.people.findFirst({
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
  });

  const { data: person, opacity } = useFadeInQuery(
    query,
    ["people", "authors", "narrators"],
    [personId],
  );

  const [ids, setIds] = useState<{
    personId: string;
    authorIds: string[];
    narratorIds: string[];
  } | null>(null);

  useEffect(() => {
    if (!person) return;

    setIds({
      personId,
      authorIds: person.authors.map((a) => a.id),
      narratorIds: person.narrators.map((n) => n.id),
    });
  }, [person, personId]);

  return { ids, opacity };
}

export function usePersonHeaderInfo(session: Session, personId: string) {
  const query = db.query.people.findFirst({
    columns: {
      name: true,
      thumbnails: true,
    },
    where: and(
      eq(schema.people.url, session.url),
      eq(schema.people.id, personId),
    ),
  });

  return useFadeInQuery(query, ["people"], [personId]);
}

export function usePersonDescription(session: Session, personId: string) {
  const query = db.query.people.findFirst({
    columns: { description: true },
    where: and(
      eq(schema.people.url, session.url),
      eq(schema.people.id, personId),
    ),
  });

  return useFadeInQuery(query, ["people"], [personId]);
}

export function useBooksByAuthor(session: Session, authorId: string) {
  const bookIdsQuery = db
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
      and(eq(schema.authors.url, session.url), eq(schema.authors.id, authorId)),
    );

  const { data: bookIds, updatedAt: bookIdsUpdatedAt } = useLiveTablesQuery(
    bookIdsQuery,
    ["authors", "book_authors", "books"],
    [authorId],
  );

  const authorQuery = db.query.authors.findFirst({
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
  });

  const { data: author, updatedAt: authorUpdatedAt } = useLiveTablesQuery(
    authorQuery,
    ["authors", "people"],
    [authorId],
  );

  const booksQuery = db.query.books.findMany({
    columns: { id: true, title: true },
    where: and(
      eq(schema.books.url, session.url),
      inArray(
        schema.books.id,
        bookIds.map((book) => book.id),
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
  });

  const { data: books, updatedAt: booksUpdatedAt } = useLiveTablesQuery(
    booksQuery,
    [
      "books",
      "book_authors",
      "authors",
      "media",
      "media_narrators",
      "narrators",
      "downloads",
    ],
    [bookIds],
  );

  const opacity = useSharedValue(0);

  useEffect(() => {
    if (
      bookIdsUpdatedAt !== undefined &&
      authorUpdatedAt !== undefined &&
      booksUpdatedAt !== undefined
    ) {
      opacity.value = withTiming(1);
    }
  }, [opacity, bookIdsUpdatedAt, authorUpdatedAt, booksUpdatedAt]);

  return { books, author, opacity };
}

export function useMediaByNarrator(session: Session, narratorId: string) {
  const mediaIdsQuery = db
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
    // .innerJoin(
    //   schema.books,
    //   and(
    //     eq(schema.media.url, schema.books.url),
    //     eq(schema.media.bookId, schema.books.id),
    //   ),
    // )
    .where(
      and(
        eq(schema.narrators.url, session.url),
        eq(schema.narrators.id, narratorId),
      ),
    );

  const { data: mediaIds, updatedAt: mediaIdsUpdatedAt } = useLiveTablesQuery(
    mediaIdsQuery,
    ["narrators", "media_narrators", "media", "books"],
    [narratorId],
  );

  const narratorQuery = db.query.narrators.findFirst({
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
  });

  const { data: narrator, updatedAt: narratorUpdatedAt } = useLiveTablesQuery(
    narratorQuery,
    ["narrators", "people"],
    [narratorId],
  );

  const mediaQuery = db.query.media.findMany({
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
  });

  const { data: media, updatedAt: mediaUpdatedAt } = useLiveTablesQuery(
    mediaQuery,
    [
      "media",
      "media_narrators",
      "narrators",
      "downloads",
      "books",
      "book_authors",
      "authors",
    ],
    [mediaIds],
  );

  const opacity = useSharedValue(0);

  useEffect(() => {
    if (
      mediaIdsUpdatedAt !== undefined &&
      narratorUpdatedAt !== undefined &&
      mediaUpdatedAt !== undefined
    ) {
      opacity.value = withTiming(1);
    }
  }, [opacity, mediaIdsUpdatedAt, narratorUpdatedAt, mediaUpdatedAt]);

  return { media, narrator, opacity };
}
