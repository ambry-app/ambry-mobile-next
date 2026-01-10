/**
 * Test fixtures for sync tests.
 * Factory functions to create GraphQL response data matching sync queries/mutations.
 */
import type {
  LibraryChangesSinceQuery,
  SyncProgressMutation,
} from "@/graphql/client/graphql";
import {
  DateFormat,
  DeletionType,
  MediaProcessingStatus,
  PlaybackEventType,
  PlaythroughStatus,
} from "@/graphql/client/graphql";

// Re-export for convenience in tests
export {
  DateFormat,
  DeletionType,
  MediaProcessingStatus,
  PlaybackEventType,
  PlaythroughStatus,
};

// Type aliases for individual array element types
type PersonChange = LibraryChangesSinceQuery["peopleChangedSince"][number];
type AuthorChange = LibraryChangesSinceQuery["authorsChangedSince"][number];
type NarratorChange = LibraryChangesSinceQuery["narratorsChangedSince"][number];
type BookChange = LibraryChangesSinceQuery["booksChangedSince"][number];
type BookAuthorChange =
  LibraryChangesSinceQuery["bookAuthorsChangedSince"][number];
type SeriesChange = LibraryChangesSinceQuery["seriesChangedSince"][number];
type SeriesBookChange =
  LibraryChangesSinceQuery["seriesBooksChangedSince"][number];
type MediaChange = LibraryChangesSinceQuery["mediaChangedSince"][number];
type MediaNarratorChange =
  LibraryChangesSinceQuery["mediaNarratorsChangedSince"][number];
type DeletionChange = LibraryChangesSinceQuery["deletionsSince"][number];

// Counter for unique IDs
let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

export function resetSyncFixtureIdCounter(): void {
  idCounter = 0;
}

// =============================================================================
// Empty response helper
// =============================================================================

export function emptyLibraryChanges(
  serverTime = new Date().toISOString(),
): LibraryChangesSinceQuery {
  return {
    serverTime,
    peopleChangedSince: [],
    authorsChangedSince: [],
    narratorsChangedSince: [],
    booksChangedSince: [],
    bookAuthorsChangedSince: [],
    seriesChangedSince: [],
    seriesBooksChangedSince: [],
    mediaChangedSince: [],
    mediaNarratorsChangedSince: [],
    deletionsSince: [],
  };
}

// =============================================================================
// Person
// =============================================================================

export function createLibraryPerson(
  overrides: Partial<PersonChange> = {},
): PersonChange {
  const id = overrides.id ?? nextId("person");
  const now = new Date().toISOString();

  return {
    __typename: "Person",
    id,
    name: `Person ${id}`,
    description: null,
    thumbnails: null,
    insertedAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// =============================================================================
// Author
// =============================================================================

export function createLibraryAuthor(
  overrides: Partial<AuthorChange> & { personId?: string } = {},
): AuthorChange {
  const id = overrides.id ?? nextId("author");
  const personId = overrides.personId ?? nextId("person");
  const now = new Date().toISOString();

  return {
    __typename: "Author",
    id,
    name: `Author ${id}`,
    person: { __typename: "Person", id: personId },
    insertedAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// =============================================================================
// Narrator
// =============================================================================

export function createLibraryNarrator(
  overrides: Partial<NarratorChange> & { personId?: string } = {},
): NarratorChange {
  const id = overrides.id ?? nextId("narrator");
  const personId = overrides.personId ?? nextId("person");
  const now = new Date().toISOString();

  return {
    __typename: "Narrator",
    id,
    name: `Narrator ${id}`,
    person: { __typename: "Person", id: personId },
    insertedAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// =============================================================================
// Book
// =============================================================================

export function createLibraryBook(
  overrides: Partial<BookChange> = {},
): BookChange {
  const id = overrides.id ?? nextId("book");
  const now = new Date().toISOString();

  return {
    __typename: "Book",
    id,
    title: `Book ${id}`,
    published: now,
    publishedFormat: DateFormat.Full,
    insertedAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// =============================================================================
// Book Author (join table)
// =============================================================================

export function createLibraryBookAuthor(
  overrides: Partial<BookAuthorChange> & {
    bookId?: string;
    authorId?: string;
  } = {},
): BookAuthorChange {
  const id = overrides.id ?? nextId("book-author");
  const bookId = overrides.bookId ?? nextId("book");
  const authorId = overrides.authorId ?? nextId("author");
  const now = new Date().toISOString();

  return {
    __typename: "BookAuthor",
    id,
    book: { __typename: "Book", id: bookId },
    author: { __typename: "Author", id: authorId },
    insertedAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// =============================================================================
// Series
// =============================================================================

export function createLibrarySeries(
  overrides: Partial<SeriesChange> = {},
): SeriesChange {
  const id = overrides.id ?? nextId("series");
  const now = new Date().toISOString();

  return {
    __typename: "Series",
    id,
    name: `Series ${id}`,
    insertedAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// =============================================================================
// Series Book (join table)
// =============================================================================

export function createLibrarySeriesBook(
  overrides: Partial<SeriesBookChange> & {
    bookId?: string;
    seriesId?: string;
  } = {},
): SeriesBookChange {
  const id = overrides.id ?? nextId("series-book");
  const bookId = overrides.bookId ?? nextId("book");
  const seriesId = overrides.seriesId ?? nextId("series");
  const now = new Date().toISOString();

  return {
    __typename: "SeriesBook",
    id,
    book: { __typename: "Book", id: bookId },
    series: { __typename: "Series", id: seriesId },
    bookNumber: "1",
    insertedAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// =============================================================================
// Media
// =============================================================================

export function createLibraryMedia(
  overrides: Partial<MediaChange> & { bookId?: string } = {},
): MediaChange {
  const id = overrides.id ?? nextId("media");
  const bookId = overrides.bookId ?? nextId("book");
  const now = new Date().toISOString();

  return {
    __typename: "Media",
    id,
    book: { __typename: "Book", id: bookId },
    status: MediaProcessingStatus.Ready,
    description: null,
    thumbnails: null,
    published: null,
    publishedFormat: DateFormat.Full,
    publisher: null,
    notes: null,
    abridged: false,
    fullCast: false,
    mp4Path: `/uploads/${id}/mp4.m3u8`,
    mpdPath: `/uploads/${id}/dash.mpd`,
    hlsPath: `/uploads/${id}/hls.m3u8`,
    duration: 3600,
    chapters: [],
    supplementalFiles: [],
    insertedAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// =============================================================================
// Media Narrator (join table)
// =============================================================================

export function createLibraryMediaNarrator(
  overrides: Partial<MediaNarratorChange> & {
    mediaId?: string;
    narratorId?: string;
  } = {},
): MediaNarratorChange {
  const id = overrides.id ?? nextId("media-narrator");
  const mediaId = overrides.mediaId ?? nextId("media");
  const narratorId = overrides.narratorId ?? nextId("narrator");
  const now = new Date().toISOString();

  return {
    __typename: "MediaNarrator",
    id,
    media: { __typename: "Media", id: mediaId },
    narrator: { __typename: "Narrator", id: narratorId },
    insertedAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// =============================================================================
// Deletion
// =============================================================================

export function createLibraryDeletion(
  type: DeletionType,
  recordId: string,
): DeletionChange {
  return {
    __typename: "Deletion",
    type,
    recordId,
  };
}

// =============================================================================
// Sync Progress (syncPlaythroughs)
// =============================================================================

type SyncProgressPayload = NonNullable<SyncProgressMutation["syncProgress"]>;
type PlaythroughChange = SyncProgressPayload["playthroughs"][number];
type PlaybackEventChange = SyncProgressPayload["events"][number];

export function emptySyncProgressResult(
  serverTime = new Date().toISOString(),
): SyncProgressPayload {
  return {
    __typename: "SyncProgressPayload",
    serverTime,
    playthroughs: [],
    events: [],
  };
}

export function createSyncPlaythrough(
  overrides: Partial<PlaythroughChange> & { mediaId?: string } = {},
): PlaythroughChange {
  const id = overrides.id ?? nextId("playthrough");
  const mediaId = overrides.mediaId ?? nextId("media");
  const now = new Date().toISOString();

  return {
    __typename: "Playthrough",
    id,
    media: { __typename: "Media", id: mediaId },
    status: PlaythroughStatus.InProgress,
    startedAt: now,
    finishedAt: null,
    abandonedAt: null,
    deletedAt: null,
    insertedAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createSyncPlaybackEvent(
  overrides: Partial<PlaybackEventChange> & { playthroughId?: string } = {},
): PlaybackEventChange {
  const id = overrides.id ?? nextId("event");
  const playthroughId = overrides.playthroughId ?? nextId("playthrough");
  const now = new Date().toISOString();

  return {
    __typename: "PlaybackEvent",
    id,
    playthroughId,
    deviceId: null,
    type: PlaybackEventType.Play,
    timestamp: now,
    position: 0,
    playbackRate: 1.0,
    fromPosition: null,
    toPosition: null,
    previousRate: null,
    ...overrides,
  };
}
