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

import {
  DEFAULT_SLEEP_TIMER_ENABLED,
  DEFAULT_SLEEP_TIMER_MOTION_DETECTION_ENABLED,
  DEFAULT_SLEEP_TIMER_SECONDS,
} from "@/constants";

export type Thumbnails = {
  extraLarge: string;
  large: string;
  medium: string;
  small: string;
  extraSmall: string;
  thumbhash: string;
};

/**
 * One downloaded audio file of a recording, as a path relative to the document
 * directory. Keyed by track so a re-scan that reorders files cannot silently
 * point playback at the wrong one.
 */
export type DownloadedFile = {
  trackId: string;
  path: string;
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
  authorPeople: many(authorPeople),
  narrators: many(narrators),
}));

// An author is a byline, not a human. It links to one or more people, so one
// person can write under several pen names and one pen name ("James S.A.
// Corey") can be shared by several people.
export const authors = sqliteTable(
  "authors",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    insertedAt: integer("inserted_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.url, table.id] })],
);

export const authorsRelations = relations(authors, ({ many }) => ({
  authorPeople: many(authorPeople),
  bookAuthors: many(bookAuthors),
}));

export const authorPeople = sqliteTable(
  "author_people",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    authorId: text("author_id").notNull(),
    personId: text("person_id").notNull(),
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
      columns: [table.url, table.personId],
      foreignColumns: [people.url, people.id],
    }).onDelete("cascade"),
    index("author_people_author_index").on(table.url, table.authorId),
    index("author_people_person_index").on(table.url, table.personId),
  ],
);

export const authorPeopleRelations = relations(authorPeople, ({ one }) => ({
  author: one(authors, {
    fields: [authorPeople.url, authorPeople.authorId],
    references: [authors.url, authors.id],
  }),
  person: one(people, {
    fields: [authorPeople.url, authorPeople.personId],
    references: [people.url, people.id],
  }),
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
  bookUniverses: many(bookUniverses),
  media: many(media),
}));

// A universe collects books that share a setting across series boundaries
// (Cosmere, the Wizarding World). A book can belong to several.
export const universes = sqliteTable(
  "universes",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    insertedAt: integer("inserted_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.url, table.id] })],
);

export const universesRelations = relations(universes, ({ many }) => ({
  bookUniverses: many(bookUniverses),
}));

export const bookUniverses = sqliteTable(
  "book_universes",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    bookId: text("book_id").notNull(),
    universeId: text("universe_id").notNull(),
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
      columns: [table.url, table.universeId],
      foreignColumns: [universes.url, universes.id],
    }).onDelete("cascade"),
    index("book_universes_book_index").on(table.url, table.bookId),
    index("book_universes_universe_index").on(table.url, table.universeId),
  ],
);

export const bookUniversesRelations = relations(bookUniverses, ({ one }) => ({
  book: one(books, {
    fields: [bookUniverses.url, bookUniverses.bookId],
    references: [books.url, books.id],
  }),
  universe: one(universes, {
    fields: [bookUniverses.url, bookUniverses.universeId],
    references: [universes.url, universes.id],
  }),
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
    // Which series comes first when a book belongs to several, as the operator
    // ordered them on the server.
    position: integer("position").notNull().default(0),
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
    // Billing order: position 0 is the book's primary author.
    position: integer("position").notNull().default(0),
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

// A set of audiobooks that together cover one book, released as separate parts
// ("Part 2 of 3"). The server calls it a recording group; `name` is an
// admin-only label and is deliberately never displayed.
export const recordingGroups = sqliteTable(
  "recording_groups",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    bookId: text("book_id").notNull(),
    // How many parts the set has, when known.
    partsTotal: integer("parts_total"),
    // Wording for one part / several parts; null means "part" / "parts".
    partWord: text("part_word"),
    partWordPlural: text("part_word_plural"),
    insertedAt: integer("inserted_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.url, table.id] }),
    foreignKey({
      columns: [table.url, table.bookId],
      foreignColumns: [books.url, books.id],
    }).onDelete("cascade"),
    index("recording_groups_book_index").on(table.url, table.bookId),
  ],
);

export const recordingGroupsRelations = relations(
  recordingGroups,
  ({ one, many }) => ({
    book: one(books, {
      fields: [recordingGroups.url, recordingGroups.bookId],
      references: [books.url, books.id],
    }),
    media: many(media),
  }),
);

export const media = sqliteTable(
  "media",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    status: text("status", {
      enum: ["pending", "processing", "error", "ready"],
    }),
    bookId: text("book_id").notNull(),
    // Display-title override for this audiobook (translated, regional or retail
    // title). Null means the book's own title applies.
    title: text("title"),
    // This audiobook's place in its set, if it is part of one.
    recordingGroupId: text("recording_group_id"),
    partNumber: integer("part_number"),
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
    foreignKey({
      columns: [table.url, table.recordingGroupId],
      foreignColumns: [recordingGroups.url, recordingGroups.id],
    }).onDelete("set null"),
    index("media_book_index").on(table.url, table.bookId),
    index("media_recording_group_index").on(table.url, table.recordingGroupId),
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
  recordingGroup: one(recordingGroups, {
    fields: [media.url, media.recordingGroupId],
    references: [recordingGroups.url, recordingGroups.id],
  }),
  mediaNarrators: many(mediaNarrators),
  mediaTracks: many(mediaTracks),
  download: one(downloads),
}));

export type SeekAccuracy = "exact" | "approximate";

// One audio file of an audiobook, played directly without transcoding. A
// recording is an ordered list of these against one continuous book timeline;
// the player treats positions as absolute book-seconds throughout.
export const mediaTracks = sqliteTable(
  "media_tracks",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    mediaId: text("media_id").notNull(),
    // Position in the ordered track list, 0-based. The column is not called
    // "index" because that is a reserved word in SQLite, and an unquoted
    // reference to it in an upsert is a syntax error that takes the whole
    // sync transaction down with it.
    index: integer("track_index").notNull(),
    path: text("path").notNull(),
    // Bytes. Real rather than integer because audiobook files routinely exceed
    // what a 32-bit int holds.
    size: real("size").notNull(),
    mime: text("mime"),
    format: text("format"),
    codec: text("codec"),
    duration: real("duration").notNull(),
    // Where this track starts on the book's continuous timeline, in seconds.
    startOffset: real("start_offset").notNull(),
    seekAccuracy: text("seek_accuracy", {
      enum: ["exact", "approximate"],
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
    index("media_tracks_media_index").on(table.url, table.mediaId, table.index),
  ],
);

export const mediaTracksRelations = relations(mediaTracks, ({ one }) => ({
  media: one(media, {
    fields: [mediaTracks.url, mediaTracks.mediaId],
    references: [media.url, media.id],
  }),
}));

export const mediaNarrators = sqliteTable(
  "media_narrators",
  {
    url: text("url").notNull(),
    id: text("id").notNull(),
    mediaId: text("media_id").notNull(),
    narratorId: text("narrator_id").notNull(),
    // Billing order: position 0 is the recording's lead narrator.
    position: integer("position").notNull().default(0),
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

// =============================================================================
// Playthrough Event Sourcing (new sync model)
// =============================================================================

export type PlaythroughStatus = "in_progress" | "finished" | "abandoned";
export type PlaybackEventType =
  | "start"
  | "play"
  | "pause"
  | "seek"
  | "rate_change"
  | "finish"
  | "abandon"
  | "resume"
  | "delete";

// Represents a user's journey through a book (from start to finish/abandon)
export const playthroughs = sqliteTable(
  "playthroughs",
  {
    id: text("id").notNull(),
    url: text("url").notNull(),
    userEmail: text("user_email").notNull(),
    mediaId: text("media_id").notNull(),
    status: text("status", {
      enum: ["in_progress", "finished", "abandoned", "deleted"],
    })
      .notNull()
      .default("in_progress"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
    abandonedAt: integer("abandoned_at", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    position: real("position").notNull(),
    playbackRate: real("playback_rate").notNull(),
    lastEventAt: integer("last_event_at", { mode: "timestamp_ms" }).notNull(),
    refreshedAt: integer("refreshed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.url, table.id] }),
    foreignKey({
      columns: [table.url, table.mediaId],
      foreignColumns: [media.url, media.id],
    }).onDelete("cascade"),
    index("playthroughs_user_media_idx").on(
      table.url,
      table.userEmail,
      table.mediaId,
    ),
  ],
);

export const playthroughsRelations = relations(
  playthroughs,
  ({ one, many }) => ({
    media: one(media, {
      fields: [playthroughs.url, playthroughs.mediaId],
      references: [media.url, media.id],
    }),
    events: many(playbackEvents),
    stateCache: one(playthroughStateCache, {
      fields: [playthroughs.id],
      references: [playthroughStateCache.playthroughId],
    }),
  }),
);

// Immutable record of something that happened during playback
export const playbackEvents = sqliteTable(
  "playback_events",
  {
    id: text("id").primaryKey(),
    playthroughId: text("playthrough_id").notNull(),
    deviceId: text("device_id"),
    mediaId: text("media_id"), // Only set on start events - identifies the media being played
    type: text("type", {
      enum: [
        "start",
        "play",
        "pause",
        "seek",
        "rate_change",
        "finish",
        "abandon",
        "resume",
        "delete",
      ],
    }).notNull(),
    timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),
    // position/playbackRate required for playback events, null for lifecycle events
    position: real("position"),
    playbackRate: real("playback_rate"),
    // seek only
    fromPosition: real("from_position"),
    toPosition: real("to_position"),
    // rate_change only
    previousRate: real("previous_rate"),
    syncedAt: integer("synced_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("playback_events_playthrough_timestamp_idx").on(
      table.playthroughId,
      table.timestamp,
    ),
    index("playback_events_synced_at_idx").on(table.syncedAt),
  ],
);

export const playbackEventsRelations = relations(playbackEvents, ({ one }) => ({
  playthrough: one(playthroughs, {
    fields: [playbackEvents.playthroughId],
    references: [playthroughs.id],
  }),
}));

// Cache for the heartbeat service to store the current position for crash recovery.
export const playthroughStateCache = sqliteTable("playthrough_state_cache", {
  playthroughId: text("playthrough_id").primaryKey(),
  position: real("position").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const playthroughStateCacheRelations = relations(
  playthroughStateCache,
  ({ one }) => ({
    playthrough: one(playthroughs, {
      fields: [playthroughStateCache.playthroughId],
      references: [playthroughs.id],
    }),
  }),
);

export type PlaythroughInsert = typeof playthroughs.$inferInsert;
export type PlaythroughSelect = typeof playthroughs.$inferSelect;
export type PlaybackEventInsert = typeof playbackEvents.$inferInsert;
export type PlaybackEventSelect = typeof playbackEvents.$inferSelect;
export type PlaythroughStateCacheInsert =
  typeof playthroughStateCache.$inferInsert;
export type PlaythroughStateCacheSelect =
  typeof playthroughStateCache.$inferSelect;

// =============================================================================
// Sync Metadata
// =============================================================================

// data related to servers that we have synced with, but unrelated to any
// specific user account
export const syncedServers = sqliteTable("synced_servers", {
  url: text("url").notNull().primaryKey(),
  // timestamp of last sync check for library data (used for incremental sync)
  lastSyncTime: integer("last_sync_time", { mode: "timestamp_ms" }),
  // timestamp when library data actually changed locally (used for cache invalidation)
  libraryDataVersion: integer("library_data_version", { mode: "timestamp_ms" }),
  // Set when a schema change adds columns the server has no reason to re-send,
  // asking the next sync to re-fetch every entity. Deliberately separate from
  // clearing lastSyncTime: the cursor still says when this device last heard
  // about a deletion, and throwing it away is what loses deletions.
  needsFullRefetch: integer("needs_full_refetch", { mode: "boolean" })
    .notNull()
    .default(false),
});

// data related to user accounts on specific servers
export const serverProfiles = sqliteTable(
  "server_profiles",
  {
    url: text("url").notNull(),
    userEmail: text("user_email").notNull(),
    // timestamp of last playthrough sync (bidirectional - send unsynced + receive server updates)
    lastSyncTime: integer("last_sync_time", { mode: "timestamp_ms" }),
    // timestamp of the last time a full sync was run for this profile.
    lastFullPlaythroughSyncTime: integer("last_full_playthrough_sync_time", {
      mode: "timestamp_ms",
    }),
    // the playthrough that was last loaded into the player on this device
    activePlaythroughId: text("active_playthrough_id"),
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
    // Legacy packaged media: the single downloaded file. Empty for direct-play
    // recordings, which store their files below.
    filePath: text("file_path").notNull(),
    // Direct-play recordings: every file of the recording, in playback order.
    files: text("files", { mode: "json" }).$type<DownloadedFile[] | null>(),
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

// Local settings belong to this device, not to any account or server. Whoever
// holds the phone keeps their playback and sleep timer preferences no matter
// which server or email they sign in with. The table holds a single row.
export const localSettings = sqliteTable("local_settings", {
  id: text("id").notNull().primaryKey().default("local"),
  preferredPlaybackRate: real("preferred_playback_rate").notNull().default(1),
  sleepTimer: integer("sleep_timer")
    .notNull()
    .default(DEFAULT_SLEEP_TIMER_SECONDS),
  sleepTimerEnabled: integer("sleep_timer_enabled", { mode: "boolean" })
    .notNull()
    .default(DEFAULT_SLEEP_TIMER_ENABLED),
  sleepTimerMotionDetectionEnabled: integer(
    "sleep_timer_motion_detection_enabled",
    { mode: "boolean" },
  )
    .notNull()
    .default(DEFAULT_SLEEP_TIMER_MOTION_DETECTION_ENABLED),
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
