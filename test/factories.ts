/**
 * Test factories for creating database entities with sensible defaults.
 * Each factory handles FK dependencies automatically.
 */
import * as schema from "@/db/schema";

import type { TestDatabase } from "./db-test-utils";

// Default test session for multi-tenant scoping
export const DEFAULT_TEST_SESSION = {
  url: "http://test-server.com",
  email: "test@example.com",
  token: "test-token",
};

// Counter for generating unique IDs
let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

// Reset counter between test files if needed
export function resetIdCounter(): void {
  idCounter = 0;
}

// =============================================================================
// People, Authors, Narrators
// =============================================================================

type PersonOverrides = Partial<typeof schema.people.$inferInsert>;

export async function createPerson(
  db: TestDatabase,
  overrides: PersonOverrides = {},
): Promise<typeof schema.people.$inferSelect> {
  const now = new Date();
  const id = overrides.id ?? nextId("person");

  const person: typeof schema.people.$inferInsert = {
    url: DEFAULT_TEST_SESSION.url,
    id,
    name: `Person ${id}`,
    insertedAt: now,
    updatedAt: now,
    ...overrides,
  };

  await db.insert(schema.people).values(person);

  const result = await db.query.people.findFirst({
    where: (p, { and, eq }) => and(eq(p.url, person.url), eq(p.id, person.id)),
  });

  return result!;
}

type AuthorOverrides = Partial<typeof schema.authors.$inferInsert> & {
  person?: PersonOverrides;
};

export async function createAuthor(
  db: TestDatabase,
  overrides: AuthorOverrides = {},
): Promise<typeof schema.authors.$inferSelect> {
  const now = new Date();
  const { person: personOverrides, ...rest } = overrides;
  const id = rest.id ?? nextId("author");
  const url = rest.url ?? DEFAULT_TEST_SESSION.url;

  // Create or use existing person
  let personId = rest.personId;
  if (!personId) {
    const person = await createPerson(db, {
      url,
      ...personOverrides,
    });
    personId = person.id;
  }

  const author: typeof schema.authors.$inferInsert = {
    url,
    id,
    name: rest.name ?? `Author ${id}`,
    personId,
    insertedAt: now,
    updatedAt: now,
    ...rest,
  };

  await db.insert(schema.authors).values(author);

  const result = await db.query.authors.findFirst({
    where: (a, { and, eq }) => and(eq(a.url, author.url), eq(a.id, author.id)),
  });

  return result!;
}

type NarratorOverrides = Partial<typeof schema.narrators.$inferInsert> & {
  person?: PersonOverrides;
};

export async function createNarrator(
  db: TestDatabase,
  overrides: NarratorOverrides = {},
): Promise<typeof schema.narrators.$inferSelect> {
  const now = new Date();
  const { person: personOverrides, ...rest } = overrides;
  const id = rest.id ?? nextId("narrator");
  const url = rest.url ?? DEFAULT_TEST_SESSION.url;

  // Create or use existing person
  let personId = rest.personId;
  if (!personId) {
    const person = await createPerson(db, {
      url,
      ...personOverrides,
    });
    personId = person.id;
  }

  const narrator: typeof schema.narrators.$inferInsert = {
    url,
    id,
    name: rest.name ?? `Narrator ${id}`,
    personId,
    insertedAt: now,
    updatedAt: now,
    ...rest,
  };

  await db.insert(schema.narrators).values(narrator);

  const result = await db.query.narrators.findFirst({
    where: (n, { and, eq }) =>
      and(eq(n.url, narrator.url), eq(n.id, narrator.id)),
  });

  return result!;
}

// =============================================================================
// Books and Series
// =============================================================================

type BookOverrides = Partial<typeof schema.books.$inferInsert>;

export async function createBook(
  db: TestDatabase,
  overrides: BookOverrides = {},
): Promise<typeof schema.books.$inferSelect> {
  const now = new Date();
  const id = overrides.id ?? nextId("book");

  const book: typeof schema.books.$inferInsert = {
    url: DEFAULT_TEST_SESSION.url,
    id,
    title: `Book ${id}`,
    published: now,
    publishedFormat: "full",
    insertedAt: now,
    updatedAt: now,
    ...overrides,
  };

  await db.insert(schema.books).values(book);

  const result = await db.query.books.findFirst({
    where: (b, { and, eq }) => and(eq(b.url, book.url), eq(b.id, book.id)),
  });

  return result!;
}

type SeriesOverrides = Partial<typeof schema.series.$inferInsert>;

export async function createSeries(
  db: TestDatabase,
  overrides: SeriesOverrides = {},
): Promise<typeof schema.series.$inferSelect> {
  const now = new Date();
  const id = overrides.id ?? nextId("series");

  const series: typeof schema.series.$inferInsert = {
    url: DEFAULT_TEST_SESSION.url,
    id,
    name: `Series ${id}`,
    insertedAt: now,
    updatedAt: now,
    ...overrides,
  };

  await db.insert(schema.series).values(series);

  const result = await db.query.series.findFirst({
    where: (s, { and, eq }) => and(eq(s.url, series.url), eq(s.id, series.id)),
  });

  return result!;
}

type SeriesBookOverrides = Partial<typeof schema.seriesBooks.$inferInsert> & {
  book?: BookOverrides;
  series?: SeriesOverrides;
};

export async function createSeriesBook(
  db: TestDatabase,
  overrides: SeriesBookOverrides = {},
): Promise<typeof schema.seriesBooks.$inferSelect> {
  const now = new Date();
  const { book: bookOverrides, series: seriesOverrides, ...rest } = overrides;
  const id = rest.id ?? nextId("series-book");
  const url = rest.url ?? DEFAULT_TEST_SESSION.url;

  // Create or use existing book
  let bookId = rest.bookId;
  if (!bookId) {
    const book = await createBook(db, { url, ...bookOverrides });
    bookId = book.id;
  }

  // Create or use existing series
  let seriesId = rest.seriesId;
  if (!seriesId) {
    const series = await createSeries(db, { url, ...seriesOverrides });
    seriesId = series.id;
  }

  const seriesBook: typeof schema.seriesBooks.$inferInsert = {
    url,
    id,
    bookId,
    seriesId,
    bookNumber: rest.bookNumber ?? "1",
    insertedAt: now,
    updatedAt: now,
    ...rest,
  };

  await db.insert(schema.seriesBooks).values(seriesBook);

  const result = await db.query.seriesBooks.findFirst({
    where: (sb, { and, eq }) =>
      and(eq(sb.url, seriesBook.url), eq(sb.id, seriesBook.id)),
  });

  return result!;
}

type BookAuthorOverrides = Partial<typeof schema.bookAuthors.$inferInsert> & {
  book?: BookOverrides;
  author?: AuthorOverrides;
};

export async function createBookAuthor(
  db: TestDatabase,
  overrides: BookAuthorOverrides = {},
): Promise<typeof schema.bookAuthors.$inferSelect> {
  const now = new Date();
  const { book: bookOverrides, author: authorOverrides, ...rest } = overrides;
  const id = rest.id ?? nextId("book-author");
  const url = rest.url ?? DEFAULT_TEST_SESSION.url;

  // Create or use existing book
  let bookId = rest.bookId;
  if (!bookId) {
    const book = await createBook(db, { url, ...bookOverrides });
    bookId = book.id;
  }

  // Create or use existing author
  let authorId = rest.authorId;
  if (!authorId) {
    const author = await createAuthor(db, { url, ...authorOverrides });
    authorId = author.id;
  }

  const bookAuthor: typeof schema.bookAuthors.$inferInsert = {
    url,
    id,
    bookId,
    authorId,
    insertedAt: now,
    updatedAt: now,
    ...rest,
  };

  await db.insert(schema.bookAuthors).values(bookAuthor);

  const result = await db.query.bookAuthors.findFirst({
    where: (ba, { and, eq }) =>
      and(eq(ba.url, bookAuthor.url), eq(ba.id, bookAuthor.id)),
  });

  return result!;
}

// =============================================================================
// Media
// =============================================================================

type MediaOverrides = Partial<typeof schema.media.$inferInsert> & {
  book?: BookOverrides;
};

export async function createMedia(
  db: TestDatabase,
  overrides: MediaOverrides = {},
): Promise<typeof schema.media.$inferSelect> {
  const now = new Date();
  const { book: bookOverrides, ...rest } = overrides;
  const id = rest.id ?? nextId("media");
  const url = rest.url ?? DEFAULT_TEST_SESSION.url;

  // Create or use existing book
  let bookId = rest.bookId;
  if (!bookId) {
    const book = await createBook(db, { url, ...bookOverrides });
    bookId = book.id;
  }

  const media: typeof schema.media.$inferInsert = {
    url,
    id,
    bookId,
    chapters: [],
    supplementalFiles: [],
    fullCast: false,
    abridged: false,
    publishedFormat: "full",
    insertedAt: now,
    updatedAt: now,
    ...rest,
  };

  await db.insert(schema.media).values(media);

  const result = await db.query.media.findFirst({
    where: (m, { and, eq }) => and(eq(m.url, media.url), eq(m.id, media.id)),
  });

  return result!;
}

type MediaNarratorOverrides = Partial<
  typeof schema.mediaNarrators.$inferInsert
> & {
  media?: MediaOverrides;
  narrator?: NarratorOverrides;
};

export async function createMediaNarrator(
  db: TestDatabase,
  overrides: MediaNarratorOverrides = {},
): Promise<typeof schema.mediaNarrators.$inferSelect> {
  const now = new Date();
  const {
    media: mediaOverrides,
    narrator: narratorOverrides,
    ...rest
  } = overrides;
  const id = rest.id ?? nextId("media-narrator");
  const url = rest.url ?? DEFAULT_TEST_SESSION.url;

  // Create or use existing media
  let mediaId = rest.mediaId;
  if (!mediaId) {
    const media = await createMedia(db, { url, ...mediaOverrides });
    mediaId = media.id;
  }

  // Create or use existing narrator
  let narratorId = rest.narratorId;
  if (!narratorId) {
    const narrator = await createNarrator(db, { url, ...narratorOverrides });
    narratorId = narrator.id;
  }

  const mediaNarrator: typeof schema.mediaNarrators.$inferInsert = {
    url,
    id,
    mediaId,
    narratorId,
    insertedAt: now,
    updatedAt: now,
    ...rest,
  };

  await db.insert(schema.mediaNarrators).values(mediaNarrator);

  const result = await db.query.mediaNarrators.findFirst({
    where: (mn, { and, eq }) =>
      and(eq(mn.url, mediaNarrator.url), eq(mn.id, mediaNarrator.id)),
  });

  return result!;
}

// =============================================================================
// Playthroughs and Playback Events
// =============================================================================

type PlaythroughOverrides = Partial<schema.PlaythroughInsert> & {
  media?: MediaOverrides;
};

export async function createPlaythrough(
  db: TestDatabase,
  overrides: PlaythroughOverrides = {},
): Promise<schema.PlaythroughSelect> {
  const now = new Date();
  const { media: mediaOverrides, ...rest } = overrides;
  const id = rest.id ?? nextId("playthrough");
  const url = rest.url ?? DEFAULT_TEST_SESSION.url;

  // Create or use existing media
  let mediaId = rest.mediaId;
  if (!mediaId) {
    const media = await createMedia(db, { url, ...mediaOverrides });
    mediaId = media.id;
  }

  const playthrough: schema.PlaythroughInsert = {
    id,
    url,
    userEmail: DEFAULT_TEST_SESSION.email,
    mediaId,
    status: "in_progress",
    startedAt: now,
    createdAt: now,
    updatedAt: now,
    ...rest,
  };

  await db.insert(schema.playthroughs).values(playthrough);

  const result = await db.query.playthroughs.findFirst({
    where: (p, { and, eq }) =>
      and(eq(p.url, playthrough.url), eq(p.id, playthrough.id)),
  });

  return result!;
}

type PlaybackEventOverrides = Partial<schema.PlaybackEventInsert> & {
  playthrough?: PlaythroughOverrides;
};

export async function createPlaybackEvent(
  db: TestDatabase,
  overrides: PlaybackEventOverrides = {},
): Promise<schema.PlaybackEventSelect> {
  const now = new Date();
  const { playthrough: playthroughOverrides, ...rest } = overrides;
  const id = rest.id ?? nextId("event");

  // Create or use existing playthrough
  let playthroughId = rest.playthroughId;
  if (!playthroughId) {
    const playthrough = await createPlaythrough(db, playthroughOverrides);
    playthroughId = playthrough.id;
  }

  const event: schema.PlaybackEventInsert = {
    id,
    playthroughId,
    type: "play",
    timestamp: now,
    position: 0,
    playbackRate: 1.0,
    ...rest,
  };

  await db.insert(schema.playbackEvents).values(event);

  const result = await db.query.playbackEvents.findFirst({
    where: (e, { eq }) => eq(e.id, event.id),
  });

  return result!;
}

type StateCacheOverrides = Partial<schema.PlaythroughStateCacheInsert> & {
  playthrough?: PlaythroughOverrides;
};

export async function createPlaythroughStateCache(
  db: TestDatabase,
  overrides: StateCacheOverrides = {},
): Promise<schema.PlaythroughStateCacheSelect> {
  const now = new Date();
  const { playthrough: playthroughOverrides, ...rest } = overrides;

  // Create or use existing playthrough
  let playthroughId = rest.playthroughId;
  if (!playthroughId) {
    const playthrough = await createPlaythrough(db, playthroughOverrides);
    playthroughId = playthrough.id;
  }

  const cache: schema.PlaythroughStateCacheInsert = {
    playthroughId,
    currentPosition: 0,
    currentRate: 1.0,
    lastEventAt: now,
    updatedAt: now,
    ...rest,
  };

  await db.insert(schema.playthroughStateCache).values(cache);

  const result = await db.query.playthroughStateCache.findFirst({
    where: (c, { eq }) => eq(c.playthroughId, cache.playthroughId),
  });

  return result!;
}

// =============================================================================
// Player States (legacy - will be removed)
// =============================================================================

type PlayerStateOverrides = Partial<typeof schema.playerStates.$inferInsert> & {
  media?: MediaOverrides;
};

export async function createPlayerState(
  db: TestDatabase,
  overrides: PlayerStateOverrides = {},
): Promise<typeof schema.playerStates.$inferSelect> {
  const now = new Date();
  const { media: mediaOverrides, ...rest } = overrides;
  const id = rest.id ?? nextId("player-state");
  const url = rest.url ?? DEFAULT_TEST_SESSION.url;

  // Create or use existing media
  let mediaId = rest.mediaId;
  if (!mediaId) {
    const media = await createMedia(db, { url, ...mediaOverrides });
    mediaId = media.id;
  }

  const playerState: typeof schema.playerStates.$inferInsert = {
    url,
    id,
    mediaId,
    userEmail: DEFAULT_TEST_SESSION.email,
    playbackRate: 1.0,
    position: 0,
    status: "not_started",
    insertedAt: now,
    updatedAt: now,
    ...rest,
  };

  await db.insert(schema.playerStates).values(playerState);

  const result = await db.query.playerStates.findFirst({
    where: (ps, { and, eq }) =>
      and(eq(ps.url, playerState.url), eq(ps.id, playerState.id)),
  });

  return result!;
}

type LocalPlayerStateOverrides = Partial<schema.LocalPlayerStateInsert> & {
  media?: MediaOverrides;
};

export async function createLocalPlayerState(
  db: TestDatabase,
  overrides: LocalPlayerStateOverrides = {},
): Promise<typeof schema.localPlayerStates.$inferSelect> {
  const now = new Date();
  const { media: mediaOverrides, ...rest } = overrides;
  const url = rest.url ?? DEFAULT_TEST_SESSION.url;

  // Create or use existing media
  let mediaId = rest.mediaId;
  if (!mediaId) {
    const media = await createMedia(db, { url, ...mediaOverrides });
    mediaId = media.id;
  }

  const localPlayerState: schema.LocalPlayerStateInsert = {
    url,
    mediaId,
    userEmail: DEFAULT_TEST_SESSION.email,
    playbackRate: 1.0,
    position: 0,
    status: "not_started",
    insertedAt: now,
    updatedAt: now,
    ...rest,
  };

  await db.insert(schema.localPlayerStates).values(localPlayerState);

  const result = await db.query.localPlayerStates.findFirst({
    where: (lps, { and, eq }) =>
      and(
        eq(lps.url, localPlayerState.url),
        eq(lps.mediaId, localPlayerState.mediaId),
        eq(lps.userEmail, localPlayerState.userEmail),
      ),
  });

  return result!;
}

// =============================================================================
// Downloads
// =============================================================================

type DownloadOverrides = Partial<typeof schema.downloads.$inferInsert> & {
  media?: MediaOverrides;
};

export async function createDownload(
  db: TestDatabase,
  overrides: DownloadOverrides = {},
): Promise<typeof schema.downloads.$inferSelect> {
  const now = new Date();
  const { media: mediaOverrides, ...rest } = overrides;
  const url = rest.url ?? DEFAULT_TEST_SESSION.url;

  // Create or use existing media
  let mediaId = rest.mediaId;
  if (!mediaId) {
    const media = await createMedia(db, { url, ...mediaOverrides });
    mediaId = media.id;
  }

  const download: typeof schema.downloads.$inferInsert = {
    url,
    mediaId,
    downloadedAt: now,
    filePath: `/downloads/${mediaId}.mp4`,
    status: "ready",
    ...rest,
  };

  await db.insert(schema.downloads).values(download);

  const result = await db.query.downloads.findFirst({
    where: (d, { and, eq }) =>
      and(eq(d.url, download.url), eq(d.mediaId, download.mediaId)),
  });

  return result!;
}

// =============================================================================
// Sync Metadata
// =============================================================================

type SyncedServerOverrides = Partial<typeof schema.syncedServers.$inferInsert>;

export async function createSyncedServer(
  db: TestDatabase,
  overrides: SyncedServerOverrides = {},
): Promise<typeof schema.syncedServers.$inferSelect> {
  const syncedServer: typeof schema.syncedServers.$inferInsert = {
    url: DEFAULT_TEST_SESSION.url,
    ...overrides,
  };

  await db.insert(schema.syncedServers).values(syncedServer);

  const result = await db.query.syncedServers.findFirst({
    where: (ss, { eq }) => eq(ss.url, syncedServer.url),
  });

  return result!;
}

type ServerProfileOverrides = Partial<
  typeof schema.serverProfiles.$inferInsert
>;

export async function createServerProfile(
  db: TestDatabase,
  overrides: ServerProfileOverrides = {},
): Promise<typeof schema.serverProfiles.$inferSelect> {
  const serverProfile: typeof schema.serverProfiles.$inferInsert = {
    url: DEFAULT_TEST_SESSION.url,
    userEmail: DEFAULT_TEST_SESSION.email,
    ...overrides,
  };

  await db.insert(schema.serverProfiles).values(serverProfile);

  const result = await db.query.serverProfiles.findFirst({
    where: (sp, { and, eq }) =>
      and(
        eq(sp.url, serverProfile.url),
        eq(sp.userEmail, serverProfile.userEmail),
      ),
  });

  return result!;
}

// =============================================================================
// User Settings
// =============================================================================

type LocalUserSettingsOverrides = Partial<
  typeof schema.localUserSettings.$inferInsert
>;

export async function createLocalUserSettings(
  db: TestDatabase,
  overrides: LocalUserSettingsOverrides = {},
): Promise<typeof schema.localUserSettings.$inferSelect> {
  const settings: typeof schema.localUserSettings.$inferInsert = {
    userEmail: DEFAULT_TEST_SESSION.email,
    ...overrides,
  };

  await db.insert(schema.localUserSettings).values(settings);

  const result = await db.query.localUserSettings.findFirst({
    where: (s, { eq }) => eq(s.userEmail, settings.userEmail),
  });

  return result!;
}

// =============================================================================
// Shelved Media
// =============================================================================

type ShelvedMediaOverrides = Partial<
  typeof schema.shelvedMedia.$inferInsert
> & {
  media?: MediaOverrides;
};

export async function createShelvedMedia(
  db: TestDatabase,
  overrides: ShelvedMediaOverrides = {},
): Promise<typeof schema.shelvedMedia.$inferSelect> {
  const now = new Date();
  const { media: mediaOverrides, ...rest } = overrides;
  const url = rest.url ?? DEFAULT_TEST_SESSION.url;

  // Create or use existing media
  let mediaId = rest.mediaId;
  if (!mediaId) {
    const media = await createMedia(db, { url, ...mediaOverrides });
    mediaId = media.id;
  }

  const shelved: typeof schema.shelvedMedia.$inferInsert = {
    url,
    userEmail: DEFAULT_TEST_SESSION.email,
    shelfName: "Want to Listen",
    mediaId,
    addedAt: now,
    priority: 0,
    synced: false,
    ...rest,
  };

  await db.insert(schema.shelvedMedia).values(shelved);

  const result = await db.query.shelvedMedia.findFirst({
    where: (sm, { and, eq }) =>
      and(
        eq(sm.url, shelved.url),
        eq(sm.userEmail, shelved.userEmail),
        eq(sm.shelfName, shelved.shelfName),
        eq(sm.mediaId, shelved.mediaId),
      ),
  });

  return result!;
}
