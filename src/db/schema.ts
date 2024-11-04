import { relations } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export type Thumbnails = {
  extraLarge: string;
  large: string;
  medium: string;
  small: string;
  extraSmall: string;
  thumbhash: string;
};

export type DownloadedThumbnails = {
  extraLarge: string;
  large: string;
  medium: string;
  small: string;
  extraSmall: string;
  thumbhash: string;
};

export type Chapter = {
  id: string;
  title?: string | null;
  startTime: number;
  endTime?: number | null;
};

type SupplementalFile = {
  filename: string;
  label?: string | null;
  mime: string;
  path: string;
};

export type Person = typeof people.$inferSelect;
export type Author = typeof authors.$inferSelect;
export type Narrator = typeof narrators.$inferSelect;
export type Book = typeof books.$inferSelect;
export type Series = typeof series.$inferSelect;
export type SeriesBook = typeof seriesBooks.$inferSelect;
export type BookAuthor = typeof bookAuthors.$inferSelect;
export type Media = typeof media.$inferSelect;
export type MediaNarrator = typeof mediaNarrators.$inferSelect;
export type Download = typeof downloads.$inferSelect;

export const people = sqliteTable(
  "people",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    thumbnails: text("thumbnails", { mode: "json" }).$type<Thumbnails | null>(),
    insertedAt: integer("inserted_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.url, table.id] }),
    };
  },
);

export const peopleRelations = relations(people, ({ many }) => ({
  authors: many(authors),
  narrators: many(narrators),
}));

export const authors = sqliteTable(
  "authors",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    personId: text("person_id").notNull(),
    insertedAt: integer("inserted_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.url, table.id] }),
      person: foreignKey({
        columns: [table.url, table.personId],
        foreignColumns: [people.url, people.id],
      }).onDelete("cascade"),
      personIndex: index("authors_person_index").on(table.url, table.personId),
    };
  },
);

export const authorsRelations = relations(authors, ({ one, many }) => ({
  person: one(people, {
    fields: [authors.url, authors.personId],
    references: [people.url, people.id],
  }),
  bookAuthors: many(bookAuthors),
}));

export const narrators = sqliteTable(
  "narrators",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    personId: text("person_id").notNull(),
    insertedAt: integer("inserted_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.url, table.id] }),
      person: foreignKey({
        columns: [table.url, table.personId],
        foreignColumns: [people.url, people.id],
      }).onDelete("cascade"),
      personIndex: index("narrators_person_index").on(
        table.url,
        table.personId,
      ),
    };
  },
);

export const narratorsRelations = relations(narrators, ({ one, many }) => ({
  person: one(people, {
    fields: [narrators.url, narrators.personId],
    references: [people.url, people.id],
  }),
  mediaNarrators: many(mediaNarrators),
}));

export const books = sqliteTable(
  "books",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    title: text("title").notNull(),
    published: integer("published", { mode: "timestamp" }).notNull(),
    publishedFormat: text("published_format", {
      enum: ["full", "year_month", "year"],
    }).notNull(),
    insertedAt: integer("inserted_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.url, table.id] }),
      publishedIndex: index("books_published_index").on(table.published),
    };
  },
);

export const booksRelations = relations(books, ({ many }) => ({
  seriesBooks: many(seriesBooks),
  bookAuthors: many(bookAuthors),
  media: many(media),
}));

export const series = sqliteTable(
  "series",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    insertedAt: integer("inserted_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.url, table.id] }),
    };
  },
);

export const seriesRelations = relations(series, ({ many }) => ({
  seriesBooks: many(seriesBooks),
}));

export const seriesBooks = sqliteTable(
  "series_books",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    bookId: text("book_id").notNull(),
    seriesId: text("series_id").notNull(),
    bookNumber: text("book_number").notNull(),
    insertedAt: integer("inserted_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.url, table.id] }),
      book: foreignKey({
        columns: [table.url, table.bookId],
        foreignColumns: [books.url, books.id],
      }).onDelete("cascade"),
      series: foreignKey({
        columns: [table.url, table.seriesId],
        foreignColumns: [series.url, series.id],
      }).onDelete("cascade"),
      bookIndex: index("series_books_book_index").on(table.url, table.bookId),
      seriesIndex: index("series_books_series_index").on(
        table.url,
        table.seriesId,
      ),
    };
  },
);

export const seriesBooksRelations = relations(seriesBooks, ({ one }) => ({
  book: one(books, {
    fields: [seriesBooks.url, seriesBooks.bookId],
    references: [books.url, books.id],
  }),
  series: one(series, {
    fields: [seriesBooks.url, seriesBooks.seriesId],
    references: [series.url, series.id],
  }),
}));

export const bookAuthors = sqliteTable(
  "book_authors",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    authorId: text("author_id").notNull(),
    bookId: text("book_id").notNull(),
    insertedAt: integer("inserted_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.url, table.id] }),
      author: foreignKey({
        columns: [table.url, table.authorId],
        foreignColumns: [authors.url, authors.id],
      }).onDelete("cascade"),
      book: foreignKey({
        columns: [table.url, table.bookId],
        foreignColumns: [books.url, books.id],
      }).onDelete("cascade"),
      authorIndex: index("book_authors_author_index").on(
        table.url,
        table.authorId,
      ),
      bookIndex: index("book_authors_book_index").on(table.url, table.bookId),
    };
  },
);

export const bookAuthorsRelations = relations(bookAuthors, ({ one }) => ({
  author: one(authors, {
    fields: [bookAuthors.url, bookAuthors.authorId],
    references: [authors.url, authors.id],
  }),
  book: one(books, {
    fields: [bookAuthors.url, bookAuthors.bookId],
    references: [books.url, books.id],
  }),
}));

export const media = sqliteTable(
  "media",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    status: text("status", {
      enum: ["pending", "processing", "error", "ready"],
    }),
    bookId: text("book_id").notNull(),
    chapters: text("chapters", { mode: "json" }).notNull().$type<Chapter[]>(),
    supplementalFiles: text("supplemental_files", { mode: "json" })
      .notNull()
      .$type<SupplementalFile[]>(),
    fullCast: integer("full_cast", { mode: "boolean" }).notNull(),
    abridged: integer("abridged", { mode: "boolean" }).notNull(),
    mpdPath: text("mpd_path"),
    hlsPath: text("hls_path"),
    mp4Path: text("mp4_path"),
    duration: text("duration"),
    published: integer("published", { mode: "timestamp" }),
    publishedFormat: text("published_format", {
      enum: ["full", "year_month", "year"],
    }).notNull(),
    notes: text("notes"),
    thumbnails: text("thumbnails", { mode: "json" }).$type<Thumbnails | null>(),
    description: text("description"),
    publisher: text("publisher"),
    insertedAt: integer("inserted_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.url, table.id] }),
      book: foreignKey({
        columns: [table.url, table.bookId],
        foreignColumns: [books.url, books.id],
      }).onDelete("cascade"),
      bookIndex: index("media_book_index").on(table.url, table.bookId),
      statusIndex: index("media_status_index").on(table.status),
      insertedAtIndex: index("media_inserted_at_index").on(table.insertedAt),
      publishedIndex: index("media_published_index").on(table.published),
    };
  },
);

export const mediaRelations = relations(media, ({ one, many }) => ({
  book: one(books, {
    fields: [media.url, media.bookId],
    references: [books.url, books.id],
  }),
  mediaNarrators: many(mediaNarrators),
  download: one(downloads),
}));

export const mediaNarrators = sqliteTable(
  "media_narrators",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    mediaId: text("media_id").notNull(),
    narratorId: text("narrator_id").notNull(),
    insertedAt: integer("inserted_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.url, table.id] }),
      media: foreignKey({
        columns: [table.url, table.mediaId],
        foreignColumns: [media.url, media.id],
      }).onDelete("cascade"),
      narrator: foreignKey({
        columns: [table.url, table.narratorId],
        foreignColumns: [narrators.url, narrators.id],
      }).onDelete("cascade"),
      mediaIndex: index("media_narrators_media_index").on(
        table.url,
        table.mediaId,
      ),
      narratorIndex: index("media_narrators_narrator_index").on(
        table.url,
        table.narratorId,
      ),
    };
  },
);

export const mediaNarratorsRelations = relations(mediaNarrators, ({ one }) => ({
  media: one(media, {
    fields: [mediaNarrators.url, mediaNarrators.mediaId],
    references: [media.url, media.id],
  }),
  narrator: one(narrators, {
    fields: [mediaNarrators.url, mediaNarrators.narratorId],
    references: [narrators.url, narrators.id],
  }),
}));

export const playerStates = sqliteTable(
  "player_states",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    mediaId: text("media_id").notNull(),
    userEmail: text("user_email").notNull(),
    playbackRate: real("playback_rate").notNull(),
    position: real("position").notNull(),
    status: text("status", {
      enum: ["not_started", "in_progress", "finished"],
    }).notNull(),
    insertedAt: integer("inserted_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.url, table.id] }),
      media: foreignKey({
        columns: [table.url, table.mediaId],
        foreignColumns: [media.url, media.id],
      }).onDelete("cascade"),
      emailIndex: index("player_states_email_index").on(table.userEmail),
      statusIndex: index("player_states_status_index").on(table.status),
      mediaIndex: index("player_states_media_index").on(
        table.url,
        table.mediaId,
      ),
      updatedAtIndex: index("player_states_updated_at_index").on(
        table.updatedAt,
      ),
    };
  },
);

export const playerStatesRelations = relations(playerStates, ({ one }) => ({
  media: one(media, {
    fields: [playerStates.url, playerStates.mediaId],
    references: [media.url, media.id],
  }),
}));

export const localPlayerStates = sqliteTable(
  "local_player_states",
  {
    url: text("url").notNull(),
    mediaId: text("media_id").notNull(),
    userEmail: text("user_email").notNull(),
    playbackRate: real("playback_rate").notNull(),
    position: real("position").notNull(),
    status: text("status", {
      enum: ["not_started", "in_progress", "finished"],
    }).notNull(),
    insertedAt: integer("inserted_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.url, table.mediaId, table.userEmail] }),
      media: foreignKey({
        columns: [table.url, table.mediaId],
        foreignColumns: [media.url, media.id],
      }).onDelete("cascade"),
      mediaIndex: index("local_player_states_media_index").on(
        table.url,
        table.mediaId,
      ),
    };
  },
);

export const localPlayerStatesRelations = relations(
  localPlayerStates,
  ({ one }) => ({
    media: one(media, {
      fields: [localPlayerStates.url, localPlayerStates.mediaId],
      references: [media.url, media.id],
    }),
  }),
);

export const servers = sqliteTable(
  "servers",
  {
    url: text("url").notNull(),
    userEmail: text("user_email").notNull(),
    lastDownSync: integer("last_down_sync", { mode: "timestamp" }),
    lastUpSync: integer("last_up_sync", { mode: "timestamp" }),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.url, table.userEmail] }),
    };
  },
);

// downloads are associated to a server but _not_ a user. If you log into a
// different account, but login to the same server, you have access to all
// downloads associated with that server.
export const downloads = sqliteTable(
  "downloads",
  {
    url: text("url").notNull(),
    mediaId: text("media_id").notNull(),
    // when the download was initiated, not when it was completed
    downloadedAt: integer("downloaded_at", { mode: "timestamp" }).notNull(),
    filePath: text("file_path").notNull(),
    thumbnails: text("thumbnails", {
      mode: "json",
    }).$type<DownloadedThumbnails | null>(),
    downloadResumableSnapshot: text("download_resumable_snapshot"),
    status: text("status", {
      enum: ["pending", "error", "ready"],
    }).notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.url, table.mediaId] }),
      media: foreignKey({
        columns: [table.url, table.mediaId],
        foreignColumns: [media.url, media.id],
      }).onDelete("cascade"),
      mediaIndex: index("downloads_media_index").on(table.url, table.mediaId),
      downloadedAtIndex: index("downloads_downloaded_at_index").on(
        table.downloadedAt,
      ),
    };
  },
);

export const downloadsRelations = relations(downloads, ({ one }) => ({
  media: one(media, {
    fields: [downloads.url, downloads.mediaId],
    references: [media.url, media.id],
  }),
}));

export const defaultSleepTimer = 600;
export const defaultSleepTimerEnabled = false;

// Local settings are associated to a user. If you log into a different account,
// you will have different local settings.
export const localUserSettings = sqliteTable("local_user_settings", {
  userEmail: text("user_email").notNull().primaryKey(),
  preferredPlaybackRate: real("preferred_playback_rate").notNull().default(1),
  sleepTimer: integer("sleep_timer").notNull().default(defaultSleepTimer),
  sleepTimerEnabled: integer("sleep_timer_enabled", { mode: "boolean" })
    .notNull()
    .default(defaultSleepTimerEnabled),
});
