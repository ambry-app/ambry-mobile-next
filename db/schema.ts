import {
  foreignKey,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const people = sqliteTable(
  "people",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    imagePath: text("image_path"),
    insertedAt: integer("inserted_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.url, table.id] }),
    };
  },
);

export const authors = sqliteTable(
  "authors",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    personId: integer("person_id").notNull(),
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

export const narrators = sqliteTable(
  "narrators",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    personId: integer("person_id").notNull(),
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

export const seriesBooks = sqliteTable(
  "series_books",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    bookId: integer("book_id").notNull(),
    seriesId: integer("series_id").notNull(),
    bookNumber: text("book_number").notNull(),
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

export const bookAuthors = sqliteTable(
  "book_authors",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    authorId: integer("author_id").notNull(),
    bookId: integer("book_id").notNull(),
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

type Chapter = {
  time: number;
  title: string;
};

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
    bookId: integer("book_id").notNull(),
    chapters: text("chapters", { mode: "json" }).notNull().$type<Chapter[]>(),
    // supplementalFiles: text("supplemental_files", { mode: "json" }).$type<
    //   SupplementalFile[]
    // >(),
    fullCast: integer("full_cast", { mode: "boolean" }).notNull(),
    // status: text("status", {
    //   enum: ["pending", "processing", "error", "ready"],
    // }),
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
    imagePath: text("image_path"),
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

export const mediaNarrators = sqliteTable(
  "media_narrators",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    mediaId: integer("media_id").notNull(),
    narratorId: integer("narrator_id").notNull(),
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

export const servers = sqliteTable("servers", {
  url: text("url").primaryKey(),
  lastSync: integer("last_sync", { mode: "timestamp" }),
});
