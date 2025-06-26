import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import useFadeInSyncedDataQuery, {
  fadeInTime,
} from "@/src/hooks/use.fade.in.synced.data.query";
import useSyncedDataQuery from "@/src/hooks/use.synced.data.query";
import { Session } from "@/src/stores/session";
import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  like,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { useEffect, useState } from "react";
import { useSharedValue, withTiming } from "react-native-reanimated";

export * from "./library/get-media-page";
export * from "./library/get-media-header-info";
export * from "./library/get-action-bar-info";

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

export function useMediaByBookTitleSearch(
  session: Session,
  queryString: string,
) {
  const mediaIdsQuery = db
    .select({ id: schema.media.id })
    .from(schema.books)
    .innerJoin(schema.media, eq(schema.media.bookId, schema.books.id))
    .where(
      and(
        eq(schema.books.url, session.url),
        like(schema.books.title, `%${queryString}%`),
      ),
    );

  const { data: mediaIds } = useSyncedDataQuery(session, mediaIdsQuery, [
    queryString,
  ]);

  return useMediaListByIds(
    session,
    mediaIds.map((x) => x.id),
  );
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

export type BookDetails = Exclude<
  ReturnType<typeof useBookDetails>["book"],
  undefined
>;

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

  const { data, ...rest } = useFadeInSyncedDataQuery(session, query, [bookId]);

  return { book: data, ...rest };
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

  const { data: person, ...rest } = useFadeInSyncedDataQuery(session, query, [
    personId,
  ]);

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

  return { ids, ...rest };
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

  const { data, ...rest } = useFadeInSyncedDataQuery(session, query, [
    personId,
  ]);
  return { person: data, ...rest };
}

export function usePersonDescription(session: Session, personId: string) {
  const query = db.query.people.findFirst({
    columns: { description: true },
    where: and(
      eq(schema.people.url, session.url),
      eq(schema.people.id, personId),
    ),
  });

  const { data, ...rest } = useFadeInSyncedDataQuery(session, query, [
    personId,
  ]);
  return { person: data, ...rest };
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

  const { data: bookIds, updatedAt: bookIdsUpdatedAt } = useSyncedDataQuery(
    session,
    bookIdsQuery,
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

  const { data: author, updatedAt: authorUpdatedAt } = useSyncedDataQuery(
    session,
    authorQuery,
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

  const { data: books, updatedAt: booksUpdatedAt } = useSyncedDataQuery(
    session,
    booksQuery,
    [bookIds],
  );

  const opacity = useSharedValue(0);

  useEffect(() => {
    if (
      bookIdsUpdatedAt !== undefined &&
      authorUpdatedAt !== undefined &&
      booksUpdatedAt !== undefined
    ) {
      opacity.value = withTiming(1, { duration: fadeInTime });
    }
  }, [opacity, bookIdsUpdatedAt, authorUpdatedAt, booksUpdatedAt]);

  // TODO: add updatedAt and error
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
    .where(
      and(
        eq(schema.narrators.url, session.url),
        eq(schema.narrators.id, narratorId),
      ),
    );

  const { data: mediaIds, updatedAt: mediaIdsUpdatedAt } = useSyncedDataQuery(
    session,
    mediaIdsQuery,
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

  const { data: narrator, updatedAt: narratorUpdatedAt } = useSyncedDataQuery(
    session,
    narratorQuery,
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

  const { data: media, updatedAt: mediaUpdatedAt } = useSyncedDataQuery(
    session,
    mediaQuery,
    [mediaIds],
  );

  const opacity = useSharedValue(0);

  useEffect(() => {
    if (
      mediaIdsUpdatedAt !== undefined &&
      narratorUpdatedAt !== undefined &&
      mediaUpdatedAt !== undefined
    ) {
      opacity.value = withTiming(1, { duration: fadeInTime });
    }
  }, [opacity, mediaIdsUpdatedAt, narratorUpdatedAt, mediaUpdatedAt]);

  // TODO: add updatedAt and error
  return { media, narrator, opacity };
}

export function useMediaIds(session: Session, mediaId: string) {
  const query = db.query.media.findFirst({
    columns: { bookId: true },
    where: and(eq(schema.media.url, session.url), eq(schema.media.id, mediaId)),
    with: {
      book: {
        columns: {},
        with: {
          bookAuthors: {
            columns: { authorId: true },
          },
          seriesBooks: {
            columns: { seriesId: true },
          },
        },
      },
      mediaNarrators: {
        columns: { narratorId: true },
      },
    },
  });

  const { data: media, ...rest } = useFadeInSyncedDataQuery(session, query, [
    mediaId,
  ]);

  const [ids, setIds] = useState<{
    mediaId: string;
    bookId: string;
    authorIds: string[];
    seriesIds: string[];
    narratorIds: string[];
  } | null>(null);

  useEffect(() => {
    if (!media) return;

    setIds({
      mediaId,
      bookId: media.bookId,
      authorIds: media.book.bookAuthors.map((ba) => ba.authorId),
      seriesIds: media.book.seriesBooks.map((sb) => sb.seriesId),
      narratorIds: media.mediaNarrators.map((mn) => mn.narratorId),
    });
  }, [media, mediaId]);

  return { ids, ...rest };
}

export function useMediaDescription(session: Session, mediaId: string) {
  const query = db.query.media.findFirst({
    columns: {
      description: true,
      published: true,
      publishedFormat: true,
      publisher: true,
      notes: true,
    },
    with: {
      book: {
        columns: { published: true, publishedFormat: true },
      },
    },
    where: and(eq(schema.media.url, session.url), eq(schema.media.id, mediaId)),
  });

  const { data, ...rest } = useFadeInSyncedDataQuery(session, query, [mediaId]);
  return { media: data, ...rest };
}

export function useMediaAuthorsAndNarrators(session: Session, mediaId: string) {
  const query = db.query.media.findFirst({
    columns: {},
    where: and(eq(schema.media.url, session.url), eq(schema.media.id, mediaId)),
    with: {
      book: {
        columns: {},
        with: {
          bookAuthors: {
            columns: { id: true },
            with: {
              author: {
                columns: { name: true },
                with: {
                  person: {
                    columns: { id: true, name: true, thumbnails: true },
                  },
                },
              },
            },
          },
        },
      },
      mediaNarrators: {
        columns: { id: true },
        with: {
          narrator: {
            columns: { name: true },
            with: {
              person: { columns: { id: true, name: true, thumbnails: true } },
            },
          },
        },
      },
    },
  });

  const { data: media, opacity } = useFadeInSyncedDataQuery(session, query, [
    mediaId,
  ]);

  const [authorSet, setAuthorSet] = useState<Set<string>>(new Set<string>());
  const [narratorSet, setNarratorSet] = useState<Set<string>>(
    new Set<string>(),
  );

  useEffect(() => {
    if (!media) return;

    const newAuthorSet = new Set<string>();
    for (const ba of media.book.bookAuthors) {
      newAuthorSet.add(ba.author.person.id);
    }
    setAuthorSet(newAuthorSet);

    const newNarratorSet = new Set<string>();
    for (const mn of media.mediaNarrators) {
      newNarratorSet.add(mn.narrator.person.id);
    }
    setNarratorSet(newNarratorSet);
  }, [media]);

  // TODO: add updatedAt and error
  return { media, authorSet, narratorSet, opacity };
}

export function useMediaOtherEditions(
  session: Session,
  bookId: string,
  withoutMediaId: string,
) {
  const mediaIdsQuery = db
    .select({ id: schema.media.id })
    .from(schema.media)
    .limit(10)
    .where(
      and(
        eq(schema.media.url, session.url),
        eq(schema.media.bookId, bookId),
        ne(schema.media.id, withoutMediaId),
      ),
    );

  const { data: mediaIds, updatedAt: mediaIdsUpdatedAt } = useSyncedDataQuery(
    session,
    mediaIdsQuery,
    [bookId, withoutMediaId],
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
      download: {
        columns: { thumbnails: true },
      },
      mediaNarrators: {
        columns: {},
        with: {
          narrator: {
            columns: { name: true },
          },
        },
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

  const { data: media, updatedAt: mediaUpdatedAt } = useSyncedDataQuery(
    session,
    mediaQuery,
    [mediaIds],
  );

  const opacity = useSharedValue(0);

  useEffect(() => {
    if (mediaIdsUpdatedAt !== undefined && mediaUpdatedAt !== undefined) {
      opacity.value = withTiming(1, { duration: fadeInTime });
    }
  }, [opacity, mediaIdsUpdatedAt, mediaUpdatedAt]);

  // TODO: add updatedAt and error
  return { media, opacity };
}

export function useOtherBooksInSeries(session: Session, seriesId: string) {
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
        limit: 10,
        with: {
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

export function useOtherBooksByAuthor(
  session: Session,
  authorId: string,
  withoutBookId: string,
  withoutSeriesIds: string[],
) {
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
    .leftJoin(
      schema.seriesBooks,
      and(
        eq(schema.books.url, schema.seriesBooks.url),
        eq(schema.books.id, schema.seriesBooks.bookId),
      ),
    )
    .limit(10)
    .where(
      and(
        eq(schema.authors.url, session.url),
        eq(schema.authors.id, authorId),
        ne(schema.books.id, withoutBookId),
        or(
          isNull(schema.seriesBooks.seriesId),
          notInArray(schema.seriesBooks.seriesId, withoutSeriesIds),
        ),
      ),
    );

  const { data: bookIds, updatedAt: bookIdsUpdatedAt } = useSyncedDataQuery(
    session,
    bookIdsQuery,
    [authorId, withoutBookId, withoutSeriesIds],
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

  const { data: author, updatedAt: authorUpdatedAt } = useSyncedDataQuery(
    session,
    authorQuery,
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

  const { data: books, updatedAt: booksUpdatedAt } = useSyncedDataQuery(
    session,
    booksQuery,
    [bookIds],
  );

  const opacity = useSharedValue(0);

  useEffect(() => {
    if (
      bookIdsUpdatedAt !== undefined &&
      authorUpdatedAt !== undefined &&
      booksUpdatedAt !== undefined
    ) {
      opacity.value = withTiming(1, { duration: fadeInTime });
    }
  }, [opacity, bookIdsUpdatedAt, authorUpdatedAt, booksUpdatedAt]);

  // TODO: add updatedAt and error
  return { books, author, opacity };
}

export function useOtherMediaByNarrator(
  session: Session,
  narratorId: string,
  withoutMediaId: string,
  withoutSeriesIds: string[],
  withoutAuthorIds: string[],
) {
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
    .innerJoin(
      schema.books,
      and(
        eq(schema.media.url, schema.books.url),
        eq(schema.media.bookId, schema.books.id),
      ),
    )
    .innerJoin(
      schema.bookAuthors,
      and(
        eq(schema.books.url, schema.bookAuthors.url),
        eq(schema.books.id, schema.bookAuthors.bookId),
      ),
    )
    .leftJoin(
      schema.seriesBooks,
      and(
        eq(schema.books.url, schema.seriesBooks.url),
        eq(schema.books.id, schema.seriesBooks.bookId),
      ),
    )
    .limit(10)
    .where(
      and(
        eq(schema.narrators.url, session.url),
        eq(schema.narrators.id, narratorId),
        ne(schema.media.id, withoutMediaId),
        notInArray(schema.bookAuthors.authorId, withoutAuthorIds),
        or(
          isNull(schema.seriesBooks.seriesId),
          notInArray(schema.seriesBooks.seriesId, withoutSeriesIds),
        ),
      ),
    );

  const { data: mediaIds, updatedAt: mediaIdsUpdatedAt } = useSyncedDataQuery(
    session,
    mediaIdsQuery,
    [narratorId, withoutMediaId, withoutAuthorIds, withoutSeriesIds],
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

  const { data: narrator, updatedAt: narratorUpdatedAt } = useSyncedDataQuery(
    session,
    narratorQuery,
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
      download: {
        columns: { thumbnails: true },
      },
      mediaNarrators: {
        columns: {},
        with: {
          narrator: {
            columns: { name: true },
          },
        },
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

  const { data: media, updatedAt: mediaUpdatedAt } = useSyncedDataQuery(
    session,
    mediaQuery,
    [mediaIds],
  );

  const opacity = useSharedValue(0);

  useEffect(() => {
    if (
      mediaIdsUpdatedAt !== undefined &&
      narratorUpdatedAt !== undefined &&
      mediaUpdatedAt !== undefined
    ) {
      opacity.value = withTiming(1, { duration: fadeInTime });
    }
  }, [opacity, mediaIdsUpdatedAt, narratorUpdatedAt, mediaUpdatedAt]);

  // TODO: add updatedAt and error
  return { media, narrator, opacity };
}
