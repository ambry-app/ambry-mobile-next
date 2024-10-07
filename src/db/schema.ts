import { relations } from "drizzle-orm";
import {
  foreignKey,
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

export type Chapter = {
  time: number;
  title: string;
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

// type SupplementalFile = {
//   filename: string;
//   label: string;
//   mime: string;
//   path: string;
// };

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
    // supplementalFiles: text("supplemental_files", { mode: "json" }).$type<
    //   SupplementalFile[]
    // >(),
    fullCast: integer("full_cast", { mode: "boolean" }).notNull(),
    abridged: integer("abridged", { mode: "boolean" }).notNull(),
    mpdPath: text("mpd_path"),
    hlsPath: text("hls_path"),
    mp4Path: text("mp4_path"),
    duration: text("duration"),
    published: integer("published", { mode: "timestamp" }),
    publishedFormat: text("published_format", {
      enum: ["full", "year_month", "year"],
    }),
    // notes: text("notes"),
    thumbnails: text("thumbnails", { mode: "json" }).$type<Thumbnails | null>(),
    description: text("description"),
    // publisher: text("publisher"),
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

export const downloads = sqliteTable(
  "downloads",
  {
    url: text("url").notNull(),
    mediaId: text("media_id").notNull(),
    // when the download was initiated, not when it was completed
    downloadedAt: integer("downloaded_at", { mode: "timestamp" }).notNull(),
    filePath: text("file_path").notNull(),
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
    };
  },
);

export const downloadsRelations = relations(downloads, ({ one }) => ({
  media: one(media, {
    fields: [downloads.url, downloads.mediaId],
    references: [media.url, media.id],
  }),
}));
