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

export type SupplementalFile = {
  filename: string;
  label?: string | null;
  mime: string;
  path: string;
};

export type LocalPlayerStateInsert = typeof localPlayerStates.$inferInsert;

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
  (table) => [primaryKey({ columns: [table.url, table.id] })],
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
  (table) => [
    primaryKey({ columns: [table.url, table.id] }),
    foreignKey({
      columns: [table.url, table.personId],
      foreignColumns: [people.url, people.id],
    }).onDelete("cascade"),
    index("authors_person_index").on(table.url, table.personId),
  ],
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
  (table) => [
    primaryKey({ columns: [table.url, table.id] }),
    foreignKey({
      columns: [table.url, table.personId],
      foreignColumns: [people.url, people.id],
    }).onDelete("cascade"),
    index("narrators_person_index").on(table.url, table.personId),
  ],
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
  (table) => [
    primaryKey({ columns: [table.url, table.id] }),
    index("books_published_index").on(table.published),
  ],
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
  (table) => [primaryKey({ columns: [table.url, table.id] })],
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
  (table) => [
    primaryKey({ columns: [table.url, table.id] }),
    foreignKey({
      columns: [table.url, table.bookId],
      foreignColumns: [books.url, books.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.url, table.seriesId],
      foreignColumns: [series.url, series.id],
    }).onDelete("cascade"),
    index("series_books_book_index").on(table.url, table.bookId),
    index("series_books_series_index").on(table.url, table.seriesId),
  ],
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
  (table) => [
    primaryKey({ columns: [table.url, table.id] }),
    foreignKey({
      columns: [table.url, table.authorId],
      foreignColumns: [authors.url, authors.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.url, table.bookId],
      foreignColumns: [books.url, books.id],
    }).onDelete("cascade"),
    index("book_authors_author_index").on(table.url, table.authorId),
    index("book_authors_book_index").on(table.url, table.bookId),
  ],
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
  (table) => [
    primaryKey({ columns: [table.url, table.id] }),
    foreignKey({
      columns: [table.url, table.bookId],
      foreignColumns: [books.url, books.id],
    }).onDelete("cascade"),
    index("media_book_index").on(table.url, table.bookId),
    index("media_status_index").on(table.status),
    index("media_inserted_at_index").on(table.insertedAt),
    index("media_published_index").on(table.published),
    index("media_url_status_inserted_at_idx").on(
      table.url,
      table.status,
      table.insertedAt,
    ),
  ],
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
  (table) => [
    primaryKey({ columns: [table.url, table.id] }),
    foreignKey({
      columns: [table.url, table.mediaId],
      foreignColumns: [media.url, media.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.url, table.narratorId],
      foreignColumns: [narrators.url, narrators.id],
    }).onDelete("cascade"),
    index("media_narrators_media_index").on(table.url, table.mediaId),
    index("media_narrators_narrator_index").on(table.url, table.narratorId),
  ],
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
  (table) => [
    primaryKey({ columns: [table.url, table.id] }),
    foreignKey({
      columns: [table.url, table.mediaId],
      foreignColumns: [media.url, media.id],
    }).onDelete("cascade"),
    index("player_states_email_index").on(table.userEmail),
    index("player_states_status_index").on(table.status),
    index("player_states_media_index").on(table.url, table.mediaId),
    index("player_states_updated_at_index").on(table.updatedAt),
  ],
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
  (table) => [
    primaryKey({ columns: [table.url, table.mediaId, table.userEmail] }),
    foreignKey({
      columns: [table.url, table.mediaId],
      foreignColumns: [media.url, media.id],
    }).onDelete("cascade"),
    index("local_player_states_media_index").on(table.url, table.mediaId),
  ],
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

// data related to servers that we have synced with, but unrelated to any
// specific user account
export const syncedServers = sqliteTable("synced_servers", {
  url: text("url").notNull().primaryKey(),
  // the last time we checked the server for new data (library)
  lastDownSync: integer("last_down_sync", { mode: "timestamp" }),
  // the last time data was actually updated locally
  newDataAsOf: integer("new_data_as_of", { mode: "timestamp" }),
});

// data related to user accounts on specific servers
export const serverProfiles = sqliteTable(
  "server_profiles",
  {
    url: text("url").notNull(),
    userEmail: text("user_email").notNull(),
    // the last time we checked the server for new data (player states)
    lastDownSync: integer("last_down_sync", { mode: "timestamp" }),
    // the last time data was actually updated locally
    newDataAsOf: integer("new_data_as_of", { mode: "timestamp" }),
    // the last time we sent data to the server (player states)
    lastUpSync: integer("last_up_sync", { mode: "timestamp" }),
  },
  (table) => [primaryKey({ columns: [table.url, table.userEmail] })],
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
  (table) => [
    primaryKey({ columns: [table.url, table.mediaId] }),
    foreignKey({
      columns: [table.url, table.mediaId],
      foreignColumns: [media.url, media.id],
    }).onDelete("cascade"),
    index("downloads_media_index").on(table.url, table.mediaId),
    index("downloads_downloaded_at_index").on(table.downloadedAt),
  ],
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

export const shelvedMedia = sqliteTable(
  "shelved_media",
  {
    url: text("url").notNull(),
    userEmail: text("user_email").notNull(),
    shelfName: text("shelf_name").notNull(),
    mediaId: text("media_id").notNull(),
    addedAt: integer("added_at", { mode: "timestamp" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    priority: integer("priority").notNull(),
    synced: integer("synced", { mode: "boolean" }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.url, table.userEmail, table.shelfName, table.mediaId],
    }),
    foreignKey({
      columns: [table.url, table.mediaId],
      foreignColumns: [media.url, media.id],
    }).onDelete("cascade"),
    index("shelved_media_shelf_name_index").on(
      table.url,
      table.userEmail,
      table.shelfName,
    ),
    index("shelved_media_synced_index").on(
      table.url,
      table.userEmail,
      table.synced,
    ),
  ],
);

export const shelvedMediaRelations = relations(shelvedMedia, ({ one }) => ({
  media: one(media, {
    fields: [shelvedMedia.url, shelvedMedia.mediaId],
    references: [media.url, media.id],
  }),
}));
