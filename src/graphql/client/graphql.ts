/* eslint-disable */
import { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /**
   * The `Date` scalar type represents a date. The Date appears in a JSON
   * response as an ISO8601 formatted string, without a time component.
   */
  Date: { input: any; output: any; }
  /**
   * The `DateTime` scalar type represents a date and time in the UTC
   * timezone. The DateTime appears in a JSON response as an ISO8601 formatted
   * string, including UTC timezone ("Z"). The parsed date and time string will
   * be converted to UTC if there is an offset.
   */
  DateTime: { input: any; output: any; }
  /**
   * The `Decimal` scalar type represents signed double-precision fractional
   * values parsed by the `Decimal` library. The Decimal appears in a JSON
   * response as a string to preserve precision.
   */
  Decimal: { input: any; output: any; }
};

export type Author = Node & {
  __typename?: 'Author';
  authoredBooks?: Maybe<BookConnection>;
  /** The ID of an object */
  id: Scalars['ID']['output'];
  insertedAt: Scalars['DateTime']['output'];
  name: Scalars['String']['output'];
  person: Person;
  updatedAt: Scalars['DateTime']['output'];
};


export type AuthorAuthoredBooksArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type Book = Node & SearchResult & {
  __typename?: 'Book';
  authors: Array<Author>;
  /** The ID of an object */
  id: Scalars['ID']['output'];
  insertedAt: Scalars['DateTime']['output'];
  media: Array<Media>;
  published: Scalars['Date']['output'];
  publishedFormat: DateFormat;
  seriesBooks: Array<SeriesBook>;
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type BookAuthor = Node & {
  __typename?: 'BookAuthor';
  author: Author;
  book: Book;
  /** The ID of an object */
  id: Scalars['ID']['output'];
  insertedAt: Scalars['DateTime']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type BookConnection = {
  __typename?: 'BookConnection';
  edges?: Maybe<Array<Maybe<BookEdge>>>;
  pageInfo: PageInfo;
};

export type BookEdge = {
  __typename?: 'BookEdge';
  cursor?: Maybe<Scalars['String']['output']>;
  node?: Maybe<Book>;
};

export type Chapter = {
  __typename?: 'Chapter';
  endTime?: Maybe<Scalars['Float']['output']>;
  id: Scalars['ID']['output'];
  startTime: Scalars['Float']['output'];
  title?: Maybe<Scalars['String']['output']>;
};

export type CreateSessionInput = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
};

export type CreateSessionPayload = {
  __typename?: 'CreateSessionPayload';
  token: Scalars['String']['output'];
  user: User;
};

export enum DateFormat {
  Full = 'FULL',
  Year = 'YEAR',
  YearMonth = 'YEAR_MONTH'
}

export type DeleteSessionPayload = {
  __typename?: 'DeleteSessionPayload';
  deleted: Scalars['Boolean']['output'];
};

export type Deletion = Node & {
  __typename?: 'Deletion';
  deletedAt: Scalars['DateTime']['output'];
  /** The ID of an object */
  id: Scalars['ID']['output'];
  recordId: Scalars['ID']['output'];
  type: DeletionType;
};

export enum DeletionType {
  Author = 'AUTHOR',
  Book = 'BOOK',
  BookAuthor = 'BOOK_AUTHOR',
  Media = 'MEDIA',
  MediaNarrator = 'MEDIA_NARRATOR',
  Narrator = 'NARRATOR',
  Person = 'PERSON',
  Series = 'SERIES',
  SeriesBook = 'SERIES_BOOK'
}

export type DeviceInput = {
  appBuild?: InputMaybe<Scalars['String']['input']>;
  appId?: InputMaybe<Scalars['String']['input']>;
  appVersion?: InputMaybe<Scalars['String']['input']>;
  brand?: InputMaybe<Scalars['String']['input']>;
  browser?: InputMaybe<Scalars['String']['input']>;
  browserVersion?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  modelName?: InputMaybe<Scalars['String']['input']>;
  osName?: InputMaybe<Scalars['String']['input']>;
  osVersion?: InputMaybe<Scalars['String']['input']>;
  type: DeviceTypeInput;
};

export enum DeviceTypeInput {
  Android = 'ANDROID',
  Ios = 'IOS'
}

export type LoadPlayerStateInput = {
  mediaId: Scalars['ID']['input'];
};

export type LoadPlayerStatePayload = {
  __typename?: 'LoadPlayerStatePayload';
  playerState: PlayerState;
};

export type Media = Node & {
  __typename?: 'Media';
  abridged: Scalars['Boolean']['output'];
  book: Book;
  chapters: Array<Chapter>;
  description?: Maybe<Scalars['String']['output']>;
  duration?: Maybe<Scalars['Float']['output']>;
  fullCast: Scalars['Boolean']['output'];
  hlsPath?: Maybe<Scalars['String']['output']>;
  /** The ID of an object */
  id: Scalars['ID']['output'];
  /** @deprecated use `thumbnails` instead */
  imagePath?: Maybe<Scalars['String']['output']>;
  insertedAt: Scalars['DateTime']['output'];
  mp4Path?: Maybe<Scalars['String']['output']>;
  mpdPath?: Maybe<Scalars['String']['output']>;
  narrators: Array<Narrator>;
  notes?: Maybe<Scalars['String']['output']>;
  playerState?: Maybe<PlayerState>;
  published?: Maybe<Scalars['Date']['output']>;
  publishedFormat: DateFormat;
  publisher?: Maybe<Scalars['String']['output']>;
  status: MediaProcessingStatus;
  supplementalFiles: Array<SupplementalFile>;
  thumbnails?: Maybe<Thumbnails>;
  updatedAt: Scalars['DateTime']['output'];
};

export type MediaConnection = {
  __typename?: 'MediaConnection';
  edges?: Maybe<Array<Maybe<MediaEdge>>>;
  pageInfo: PageInfo;
};

export type MediaEdge = {
  __typename?: 'MediaEdge';
  cursor?: Maybe<Scalars['String']['output']>;
  node?: Maybe<Media>;
};

export type MediaNarrator = Node & {
  __typename?: 'MediaNarrator';
  /** The ID of an object */
  id: Scalars['ID']['output'];
  insertedAt: Scalars['DateTime']['output'];
  media: Media;
  narrator: Narrator;
  updatedAt: Scalars['DateTime']['output'];
};

export enum MediaProcessingStatus {
  Error = 'ERROR',
  Pending = 'PENDING',
  Processing = 'PROCESSING',
  Ready = 'READY'
}

export type Narrator = Node & {
  __typename?: 'Narrator';
  /** The ID of an object */
  id: Scalars['ID']['output'];
  insertedAt: Scalars['DateTime']['output'];
  name: Scalars['String']['output'];
  narratedMedia?: Maybe<MediaConnection>;
  person: Person;
  updatedAt: Scalars['DateTime']['output'];
};


export type NarratorNarratedMediaArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type Node = {
  /** The ID of the object. */
  id: Scalars['ID']['output'];
};

export type PageInfo = {
  __typename?: 'PageInfo';
  /** When paginating forwards, the cursor to continue. */
  endCursor?: Maybe<Scalars['String']['output']>;
  /** When paginating forwards, are there more items? */
  hasNextPage: Scalars['Boolean']['output'];
  /** When paginating backwards, are there more items? */
  hasPreviousPage: Scalars['Boolean']['output'];
  /** When paginating backwards, the cursor to continue. */
  startCursor?: Maybe<Scalars['String']['output']>;
};

export type Person = Node & SearchResult & {
  __typename?: 'Person';
  authors: Array<Author>;
  description?: Maybe<Scalars['String']['output']>;
  /** The ID of an object */
  id: Scalars['ID']['output'];
  /** @deprecated use `thumbnails` instead */
  imagePath?: Maybe<Scalars['String']['output']>;
  insertedAt: Scalars['DateTime']['output'];
  name: Scalars['String']['output'];
  narrators: Array<Narrator>;
  thumbnails?: Maybe<Thumbnails>;
  updatedAt: Scalars['DateTime']['output'];
};

export type PlaybackEvent = {
  __typename?: 'PlaybackEvent';
  deviceId?: Maybe<Scalars['ID']['output']>;
  fromPosition?: Maybe<Scalars['Float']['output']>;
  id: Scalars['ID']['output'];
  mediaId?: Maybe<Scalars['ID']['output']>;
  playbackRate?: Maybe<Scalars['Float']['output']>;
  playthroughId: Scalars['ID']['output'];
  position?: Maybe<Scalars['Float']['output']>;
  previousRate?: Maybe<Scalars['Float']['output']>;
  timestamp: Scalars['DateTime']['output'];
  toPosition?: Maybe<Scalars['Float']['output']>;
  type: PlaybackEventType;
};

export type PlaybackEventInput = {
  fromPosition?: InputMaybe<Scalars['Float']['input']>;
  id: Scalars['ID']['input'];
  mediaId?: InputMaybe<Scalars['ID']['input']>;
  playbackRate?: InputMaybe<Scalars['Float']['input']>;
  playthroughId: Scalars['ID']['input'];
  position?: InputMaybe<Scalars['Float']['input']>;
  previousRate?: InputMaybe<Scalars['Float']['input']>;
  timestamp: Scalars['DateTime']['input'];
  toPosition?: InputMaybe<Scalars['Float']['input']>;
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

export type PlayerState = Node & {
  __typename?: 'PlayerState';
  /** The ID of an object */
  id: Scalars['ID']['output'];
  insertedAt: Scalars['DateTime']['output'];
  media: Media;
  playbackRate: Scalars['Float']['output'];
  position: Scalars['Float']['output'];
  status: PlayerStateStatus;
  updatedAt: Scalars['DateTime']['output'];
};

export type PlayerStateConnection = {
  __typename?: 'PlayerStateConnection';
  edges?: Maybe<Array<Maybe<PlayerStateEdge>>>;
  pageInfo: PageInfo;
};

export type PlayerStateEdge = {
  __typename?: 'PlayerStateEdge';
  cursor?: Maybe<Scalars['String']['output']>;
  node?: Maybe<PlayerState>;
};

export enum PlayerStateStatus {
  Finished = 'FINISHED',
  InProgress = 'IN_PROGRESS',
  NotStarted = 'NOT_STARTED'
}

export type Playthrough = {
  __typename?: 'Playthrough';
  abandonedAt?: Maybe<Scalars['DateTime']['output']>;
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  finishedAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  insertedAt: Scalars['DateTime']['output'];
  media: Media;
  startedAt: Scalars['DateTime']['output'];
  status: PlaythroughStatus;
  updatedAt: Scalars['DateTime']['output'];
};

export type PlaythroughInput = {
  abandonedAt?: InputMaybe<Scalars['DateTime']['input']>;
  deletedAt?: InputMaybe<Scalars['DateTime']['input']>;
  finishedAt?: InputMaybe<Scalars['DateTime']['input']>;
  id: Scalars['ID']['input'];
  mediaId: Scalars['ID']['input'];
  startedAt: Scalars['DateTime']['input'];
  status: PlaythroughStatus;
};

export enum PlaythroughStatus {
  Abandoned = 'ABANDONED',
  Finished = 'FINISHED',
  InProgress = 'IN_PROGRESS'
}

export type RootMutationType = {
  __typename?: 'RootMutationType';
  createSession?: Maybe<CreateSessionPayload>;
  deleteSession?: Maybe<DeleteSessionPayload>;
  /** Initializes a new player state or returns an existing player state for a given Media. */
  loadPlayerState?: Maybe<LoadPlayerStatePayload>;
  /** V2 sync: events only, no playthroughs. All state is derived from events. */
  syncEvents?: Maybe<SyncEventsPayload>;
  syncProgress?: Maybe<SyncProgressPayload>;
  updatePlayerState?: Maybe<UpdatePlayerStatePayload>;
};


export type RootMutationTypeCreateSessionArgs = {
  input: CreateSessionInput;
};


export type RootMutationTypeLoadPlayerStateArgs = {
  input: LoadPlayerStateInput;
};


export type RootMutationTypeSyncEventsArgs = {
  input: SyncEventsInput;
};


export type RootMutationTypeSyncProgressArgs = {
  input: SyncProgressInput;
};


export type RootMutationTypeUpdatePlayerStateArgs = {
  input: UpdatePlayerStateInput;
};

export type RootQueryType = {
  __typename?: 'RootQueryType';
  authorsChangedSince: Array<Author>;
  bookAuthorsChangedSince: Array<BookAuthor>;
  books?: Maybe<BookConnection>;
  booksChangedSince: Array<Book>;
  deletionsSince: Array<Deletion>;
  me?: Maybe<User>;
  mediaChangedSince: Array<Media>;
  mediaNarratorsChangedSince: Array<MediaNarrator>;
  narratorsChangedSince: Array<Narrator>;
  node?: Maybe<Node>;
  peopleChangedSince: Array<Person>;
  playerStates?: Maybe<PlayerStateConnection>;
  playerStatesChangedSince: Array<PlayerState>;
  search?: Maybe<SearchResultConnection>;
  seriesBooksChangedSince: Array<SeriesBook>;
  seriesChangedSince: Array<Series>;
  serverTime: Scalars['DateTime']['output'];
};


export type RootQueryTypeAuthorsChangedSinceArgs = {
  since?: InputMaybe<Scalars['DateTime']['input']>;
};


export type RootQueryTypeBookAuthorsChangedSinceArgs = {
  since?: InputMaybe<Scalars['DateTime']['input']>;
};


export type RootQueryTypeBooksArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type RootQueryTypeBooksChangedSinceArgs = {
  since?: InputMaybe<Scalars['DateTime']['input']>;
};


export type RootQueryTypeDeletionsSinceArgs = {
  since?: InputMaybe<Scalars['DateTime']['input']>;
};


export type RootQueryTypeMediaChangedSinceArgs = {
  since?: InputMaybe<Scalars['DateTime']['input']>;
};


export type RootQueryTypeMediaNarratorsChangedSinceArgs = {
  since?: InputMaybe<Scalars['DateTime']['input']>;
};


export type RootQueryTypeNarratorsChangedSinceArgs = {
  since?: InputMaybe<Scalars['DateTime']['input']>;
};


export type RootQueryTypeNodeArgs = {
  id: Scalars['ID']['input'];
};


export type RootQueryTypePeopleChangedSinceArgs = {
  since?: InputMaybe<Scalars['DateTime']['input']>;
};


export type RootQueryTypePlayerStatesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type RootQueryTypePlayerStatesChangedSinceArgs = {
  since?: InputMaybe<Scalars['DateTime']['input']>;
};


export type RootQueryTypeSearchArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
};


export type RootQueryTypeSeriesBooksChangedSinceArgs = {
  since?: InputMaybe<Scalars['DateTime']['input']>;
};


export type RootQueryTypeSeriesChangedSinceArgs = {
  since?: InputMaybe<Scalars['DateTime']['input']>;
};

export type SearchResult = {
  id: Scalars['ID']['output'];
};

export type SearchResultConnection = {
  __typename?: 'SearchResultConnection';
  edges?: Maybe<Array<Maybe<SearchResultEdge>>>;
  pageInfo: PageInfo;
};

export type SearchResultEdge = {
  __typename?: 'SearchResultEdge';
  cursor?: Maybe<Scalars['String']['output']>;
  node?: Maybe<SearchResult>;
};

export type Series = Node & SearchResult & {
  __typename?: 'Series';
  /** The ID of an object */
  id: Scalars['ID']['output'];
  insertedAt: Scalars['DateTime']['output'];
  name: Scalars['String']['output'];
  seriesBooks?: Maybe<SeriesBookConnection>;
  updatedAt: Scalars['DateTime']['output'];
};


export type SeriesSeriesBooksArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type SeriesBook = Node & {
  __typename?: 'SeriesBook';
  book: Book;
  bookNumber: Scalars['Decimal']['output'];
  /** The ID of an object */
  id: Scalars['ID']['output'];
  insertedAt: Scalars['DateTime']['output'];
  series: Series;
  updatedAt: Scalars['DateTime']['output'];
};

export type SeriesBookConnection = {
  __typename?: 'SeriesBookConnection';
  edges?: Maybe<Array<Maybe<SeriesBookEdge>>>;
  pageInfo: PageInfo;
};

export type SeriesBookEdge = {
  __typename?: 'SeriesBookEdge';
  cursor?: Maybe<Scalars['String']['output']>;
  node?: Maybe<SeriesBook>;
};

export type SupplementalFile = {
  __typename?: 'SupplementalFile';
  filename: Scalars['String']['output'];
  label?: Maybe<Scalars['String']['output']>;
  mime: Scalars['String']['output'];
  path: Scalars['String']['output'];
};

export type SyncEventsInput = {
  device: DeviceInput;
  events: Array<PlaybackEventInput>;
  lastSyncTime?: InputMaybe<Scalars['DateTime']['input']>;
};

export type SyncEventsPayload = {
  __typename?: 'SyncEventsPayload';
  events: Array<PlaybackEvent>;
  serverTime: Scalars['DateTime']['output'];
};

export type SyncProgressInput = {
  device: DeviceInput;
  events: Array<PlaybackEventInput>;
  lastSyncTime?: InputMaybe<Scalars['DateTime']['input']>;
  playthroughs: Array<PlaythroughInput>;
};

export type SyncProgressPayload = {
  __typename?: 'SyncProgressPayload';
  events: Array<PlaybackEvent>;
  playthroughs: Array<Playthrough>;
  serverTime: Scalars['DateTime']['output'];
};

export type Thumbnails = {
  __typename?: 'Thumbnails';
  blurhash?: Maybe<Scalars['String']['output']>;
  extraLarge: Scalars['String']['output'];
  extraSmall: Scalars['String']['output'];
  large: Scalars['String']['output'];
  medium: Scalars['String']['output'];
  small: Scalars['String']['output'];
  thumbhash: Scalars['String']['output'];
};

export type UpdatePlayerStateInput = {
  mediaId: Scalars['ID']['input'];
  playbackRate?: InputMaybe<Scalars['Float']['input']>;
  position?: InputMaybe<Scalars['Float']['input']>;
};

export type UpdatePlayerStatePayload = {
  __typename?: 'UpdatePlayerStatePayload';
  playerState: PlayerState;
};

export type User = {
  __typename?: 'User';
  admin: Scalars['Boolean']['output'];
  confirmedAt?: Maybe<Scalars['DateTime']['output']>;
  email: Scalars['String']['output'];
  insertedAt: Scalars['DateTime']['output'];
  loadedPlayerState?: Maybe<PlayerState>;
  updatedAt: Scalars['DateTime']['output'];
};

export type LibraryChangesSinceQueryVariables = Exact<{
  since?: InputMaybe<Scalars['DateTime']['input']>;
}>;


export type LibraryChangesSinceQuery = { __typename?: 'RootQueryType', serverTime: any, peopleChangedSince: Array<{ __typename?: 'Person', id: string, name: string, description?: string | null, insertedAt: any, updatedAt: any, thumbnails?: { __typename?: 'Thumbnails', extraLarge: string, large: string, medium: string, small: string, extraSmall: string, thumbhash: string } | null }>, authorsChangedSince: Array<{ __typename?: 'Author', id: string, name: string, insertedAt: any, updatedAt: any, person: { __typename?: 'Person', id: string } }>, narratorsChangedSince: Array<{ __typename?: 'Narrator', id: string, name: string, insertedAt: any, updatedAt: any, person: { __typename?: 'Person', id: string } }>, booksChangedSince: Array<{ __typename?: 'Book', id: string, title: string, published: any, publishedFormat: DateFormat, insertedAt: any, updatedAt: any }>, bookAuthorsChangedSince: Array<{ __typename?: 'BookAuthor', id: string, insertedAt: any, updatedAt: any, book: { __typename?: 'Book', id: string }, author: { __typename?: 'Author', id: string } }>, seriesChangedSince: Array<{ __typename?: 'Series', id: string, name: string, insertedAt: any, updatedAt: any }>, seriesBooksChangedSince: Array<{ __typename?: 'SeriesBook', id: string, bookNumber: any, insertedAt: any, updatedAt: any, book: { __typename?: 'Book', id: string }, series: { __typename?: 'Series', id: string } }>, mediaChangedSince: Array<{ __typename?: 'Media', id: string, status: MediaProcessingStatus, description?: string | null, published?: any | null, publishedFormat: DateFormat, publisher?: string | null, notes?: string | null, abridged: boolean, fullCast: boolean, mp4Path?: string | null, mpdPath?: string | null, hlsPath?: string | null, duration?: number | null, insertedAt: any, updatedAt: any, book: { __typename?: 'Book', id: string }, thumbnails?: { __typename?: 'Thumbnails', extraLarge: string, large: string, medium: string, small: string, extraSmall: string, thumbhash: string } | null, chapters: Array<{ __typename?: 'Chapter', id: string, title?: string | null, startTime: number, endTime?: number | null }>, supplementalFiles: Array<{ __typename?: 'SupplementalFile', filename: string, label?: string | null, mime: string, path: string }> }>, mediaNarratorsChangedSince: Array<{ __typename?: 'MediaNarrator', id: string, insertedAt: any, updatedAt: any, media: { __typename?: 'Media', id: string }, narrator: { __typename?: 'Narrator', id: string } }>, deletionsSince: Array<{ __typename?: 'Deletion', type: DeletionType, recordId: string }> };

export type CreateSessionMutationVariables = Exact<{
  input: CreateSessionInput;
}>;


export type CreateSessionMutation = { __typename?: 'RootMutationType', createSession?: { __typename?: 'CreateSessionPayload', token: string } | null };

export type DeleteSessionMutationVariables = Exact<{ [key: string]: never; }>;


export type DeleteSessionMutation = { __typename?: 'RootMutationType', deleteSession?: { __typename?: 'DeleteSessionPayload', deleted: boolean } | null };

export type SyncEventsMutationVariables = Exact<{
  input: SyncEventsInput;
}>;


export type SyncEventsMutation = { __typename?: 'RootMutationType', syncEvents?: { __typename?: 'SyncEventsPayload', serverTime: any, events: Array<{ __typename?: 'PlaybackEvent', id: string, playthroughId: string, deviceId?: string | null, mediaId?: string | null, type: PlaybackEventType, timestamp: any, position?: number | null, playbackRate?: number | null, fromPosition?: number | null, toPosition?: number | null, previousRate?: number | null }> } | null };

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
    query LibraryChangesSince($since: DateTime) {
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
    person {
      id
    }
    name
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
    insertedAt
    updatedAt
  }
  mediaChangedSince(since: $since) {
    id
    book {
      id
    }
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
    insertedAt
    updatedAt
  }
  deletionsSince(since: $since) {
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