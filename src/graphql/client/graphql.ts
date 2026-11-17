/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
export type CreateSessionInput = {
  email: string;
  password: string;
};

export enum DateFormat {
  Full = 'FULL',
  Year = 'YEAR',
  YearMonth = 'YEAR_MONTH'
}

export enum DeletionType {
  Author = 'AUTHOR',
  AuthorPerson = 'AUTHOR_PERSON',
  Book = 'BOOK',
  BookAuthor = 'BOOK_AUTHOR',
  BookUniverse = 'BOOK_UNIVERSE',
  Media = 'MEDIA',
  MediaNarrator = 'MEDIA_NARRATOR',
  MediaTrack = 'MEDIA_TRACK',
  Narrator = 'NARRATOR',
  Person = 'PERSON',
  RecordingGroup = 'RECORDING_GROUP',
  Series = 'SERIES',
  SeriesBook = 'SERIES_BOOK',
  Universe = 'UNIVERSE'
}

export type DeviceInput = {
  appBuild?: string | null | undefined;
  appId?: string | null | undefined;
  appVersion?: string | null | undefined;
  brand?: string | null | undefined;
  browser?: string | null | undefined;
  browserVersion?: string | null | undefined;
  id: string | number;
  modelName?: string | null | undefined;
  osName?: string | null | undefined;
  osVersion?: string | null | undefined;
  type: DeviceTypeInput;
};

export enum DeviceTypeInput {
  Android = 'ANDROID',
  Ios = 'IOS'
}

export enum MediaProcessingStatus {
  Error = 'ERROR',
  Pending = 'PENDING',
  Processing = 'PROCESSING',
  Ready = 'READY'
}

export type PlaybackEventInput = {
  fromPosition?: number | null | undefined;
  id: string | number;
  mediaId?: string | number | null | undefined;
  playbackRate?: number | null | undefined;
  playthroughId: string | number;
  position?: number | null | undefined;
  previousRate?: number | null | undefined;
  timestamp: Date | string;
  toPosition?: number | null | undefined;
  type: PlaybackEventType;
};

export enum PlaybackEventType {
  Abandon = 'ABANDON',
  Delete = 'DELETE',
  Finish = 'FINISH',
  Pause = 'PAUSE',
  Play = 'PLAY',
  RateChange = 'RATE_CHANGE',
  Resume = 'RESUME',
  Seek = 'SEEK',
  Start = 'START'
}

/** How accurately a player can seek within a track */
export enum SeekAccuracy {
  /** The file carries no seek index (e.g. VBR mp3 with no Xing header); positions may drift */
  Approximate = 'APPROXIMATE',
  /** Seeking lands where it says it does */
  Exact = 'EXACT'
}

export type SyncEventsInput = {
  device: DeviceInput;
  events: Array<PlaybackEventInput>;
  lastSyncTime?: Date | string | null | undefined;
};

export type LibraryChangesSinceQueryVariables = Exact<{
  since?: Date | string | null | undefined;
  deletedSince?: Date | string | null | undefined;
}>;


export type LibraryChangesSinceQuery = { serverTime: string, peopleChangedSince: Array<{ id: string, name: string, description: string | null, insertedAt: string, updatedAt: string, thumbnails: { extraLarge: string, large: string, medium: string, small: string, extraSmall: string, thumbhash: string } | null }>, authorsChangedSince: Array<{ id: string, name: string, insertedAt: string, updatedAt: string }>, authorPeopleChangedSince: Array<{ id: string, insertedAt: string, updatedAt: string, author: { id: string }, person: { id: string } }>, narratorsChangedSince: Array<{ id: string, name: string, insertedAt: string, updatedAt: string, person: { id: string } }>, booksChangedSince: Array<{ id: string, title: string, published: string, publishedFormat: DateFormat, insertedAt: string, updatedAt: string }>, bookAuthorsChangedSince: Array<{ id: string, position: number, insertedAt: string, updatedAt: string, book: { id: string }, author: { id: string } }>, universesChangedSince: Array<{ id: string, name: string, insertedAt: string, updatedAt: string }>, bookUniversesChangedSince: Array<{ id: string, insertedAt: string, updatedAt: string, book: { id: string }, universe: { id: string } }>, seriesChangedSince: Array<{ id: string, name: string, insertedAt: string, updatedAt: string }>, seriesBooksChangedSince: Array<{ id: string, bookNumber: string, position: number, insertedAt: string, updatedAt: string, book: { id: string }, series: { id: string } }>, recordingGroupsChangedSince: Array<{ id: string, name: string, showLabel: boolean, partsTotal: number | null, partWord: string | null, partWordPlural: string | null, insertedAt: string, updatedAt: string, book: { id: string } }>, mediaChangedSince: Array<{ id: string, title: string | null, partNumber: number | null, status: MediaProcessingStatus, description: string | null, published: string | null, publishedFormat: DateFormat, publisher: string | null, notes: string | null, abridged: boolean, fullCast: boolean, mp4Path: string | null, mpdPath: string | null, hlsPath: string | null, duration: number | null, insertedAt: string, updatedAt: string, book: { id: string }, recordingGroup: { id: string } | null, thumbnails: { extraLarge: string, large: string, medium: string, small: string, extraSmall: string, thumbhash: string } | null, chapters: Array<{ id: string, title: string | null, startTime: number, endTime: number | null }>, supplementalFiles: Array<{ filename: string, label: string | null, mime: string, path: string }> }>, mediaNarratorsChangedSince: Array<{ id: string, position: number, insertedAt: string, updatedAt: string, media: { id: string }, narrator: { id: string } }>, mediaTracksChangedSince: Array<{ id: string, index: number, path: string, size: number, mime: string | null, format: string | null, codec: string | null, duration: number, startOffset: number, seekAccuracy: SeekAccuracy, insertedAt: string, updatedAt: string, media: { id: string } }>, deletionsSince: Array<{ type: DeletionType, recordId: string }> };

export type CreateSessionMutationVariables = Exact<{
  input: CreateSessionInput;
}>;


export type CreateSessionMutation = { createSession: { token: string } | null };

export type DeleteSessionMutationVariables = Exact<{ [key: string]: never; }>;


export type DeleteSessionMutation = { deleteSession: { deleted: boolean } | null };

export type SyncEventsMutationVariables = Exact<{
  input: SyncEventsInput;
}>;


export type SyncEventsMutation = { syncEvents: { serverTime: string, events: Array<{ id: string, playthroughId: string, deviceId: string | null, mediaId: string | null, type: PlaybackEventType, timestamp: string, position: number | null, playbackRate: number | null, fromPosition: number | null, toPosition: number | null, previousRate: number | null }> } | null };

export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: NonNullable<DocumentTypeDecoration<TResult, TVariables>['__apiType']>;
  private value: string;
  public __meta__?: Record<string, any> | undefined;

  constructor(value: string, __meta__?: Record<string, any> | undefined) {
    super(value);
    this.value = value;
    this.__meta__ = __meta__;
  }

  override toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}

export const LibraryChangesSinceDocument = new TypedDocumentString(`
    query LibraryChangesSince($since: DateTime, $deletedSince: DateTime) {
  peopleChangedSince(since: $since) {
    id
    name
    description
    thumbnails {
      extraLarge
      large
      medium
      small
      extraSmall
      thumbhash
    }
    insertedAt
    updatedAt
  }
  authorsChangedSince(since: $since) {
    id
    name
    insertedAt
    updatedAt
  }
  authorPeopleChangedSince(since: $since) {
    id
    author {
      id
    }
    person {
      id
    }
    insertedAt
    updatedAt
  }
  narratorsChangedSince(since: $since) {
    id
    person {
      id
    }
    name
    insertedAt
    updatedAt
  }
  booksChangedSince(since: $since) {
    id
    title
    published
    publishedFormat
    insertedAt
    updatedAt
  }
  bookAuthorsChangedSince(since: $since) {
    id
    book {
      id
    }
    author {
      id
    }
    position
    insertedAt
    updatedAt
  }
  universesChangedSince(since: $since) {
    id
    name
    insertedAt
    updatedAt
  }
  bookUniversesChangedSince(since: $since) {
    id
    book {
      id
    }
    universe {
      id
    }
    insertedAt
    updatedAt
  }
  seriesChangedSince(since: $since) {
    id
    name
    insertedAt
    updatedAt
  }
  seriesBooksChangedSince(since: $since) {
    id
    book {
      id
    }
    series {
      id
    }
    bookNumber
    position
    insertedAt
    updatedAt
  }
  recordingGroupsChangedSince(since: $since) {
    id
    book {
      id
    }
    name
    showLabel
    partsTotal
    partWord
    partWordPlural
    insertedAt
    updatedAt
  }
  mediaChangedSince(since: $since) {
    id
    book {
      id
    }
    title
    recordingGroup {
      id
    }
    partNumber
    status
    description
    thumbnails {
      extraLarge
      large
      medium
      small
      extraSmall
      thumbhash
    }
    published
    publishedFormat
    publisher
    notes
    abridged
    fullCast
    mp4Path
    mpdPath
    hlsPath
    duration
    chapters {
      id
      title
      startTime
      endTime
    }
    supplementalFiles {
      filename
      label
      mime
      path
    }
    insertedAt
    updatedAt
  }
  mediaNarratorsChangedSince(since: $since) {
    id
    media {
      id
    }
    narrator {
      id
    }
    position
    insertedAt
    updatedAt
  }
  mediaTracksChangedSince(since: $since) {
    id
    media {
      id
    }
    index
    path
    size
    mime
    format
    codec
    duration
    startOffset
    seekAccuracy
    insertedAt
    updatedAt
  }
  deletionsSince(since: $deletedSince) {
    type
    recordId
  }
  serverTime
}
    `) as unknown as TypedDocumentString<LibraryChangesSinceQuery, LibraryChangesSinceQueryVariables>;
export const CreateSessionDocument = new TypedDocumentString(`
    mutation CreateSession($input: CreateSessionInput!) {
  createSession(input: $input) {
    token
  }
}
    `) as unknown as TypedDocumentString<CreateSessionMutation, CreateSessionMutationVariables>;
export const DeleteSessionDocument = new TypedDocumentString(`
    mutation DeleteSession {
  deleteSession {
    deleted
  }
}
    `) as unknown as TypedDocumentString<DeleteSessionMutation, DeleteSessionMutationVariables>;
export const SyncEventsDocument = new TypedDocumentString(`
    mutation SyncEvents($input: SyncEventsInput!) {
  syncEvents(input: $input) {
    events {
      id
      playthroughId
      deviceId
      mediaId
      type
      timestamp
      position
      playbackRate
      fromPosition
      toPosition
      previousRate
    }
    serverTime
  }
}
    `) as unknown as TypedDocumentString<SyncEventsMutation, SyncEventsMutationVariables>;