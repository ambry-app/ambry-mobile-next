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
  people: Array<Person>;
  /** @deprecated use `people` instead; an author can be linked to multiple people */
  person: Person;
  updatedAt: Scalars['DateTime']['output'];
};


export type AuthorAuthoredBooksArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type AuthorPerson = Node & {
  __typename?: 'AuthorPerson';
  author: Author;
  /** The ID of an object */
  id: Scalars['ID']['output'];
  insertedAt: Scalars['DateTime']['output'];
  person: Person;
  updatedAt: Scalars['DateTime']['output'];
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
  universes: Array<Universe>;
  updatedAt: Scalars['DateTime']['output'];
};

export type BookAuthor = Node & {
  __typename?: 'BookAuthor';
  author: Author;
  book: Book;
  /** The ID of an object */
  id: Scalars['ID']['output'];
  insertedAt: Scalars['DateTime']['output'];
  position: Scalars['Int']['output'];
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

export type BookUniverse = Node & {
  __typename?: 'BookUniverse';
  book: Book;
  /** The ID of an object */
  id: Scalars['ID']['output'];
  insertedAt: Scalars['DateTime']['output'];
  universe: Universe;
  updatedAt: Scalars['DateTime']['output'];
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
  /** For multi-part recordings: this recording's position in its part set; the set's total lives on the recording group */
  partNumber?: Maybe<Scalars['Int']['output']>;
  published?: Maybe<Scalars['Date']['output']>;
  publishedFormat: DateFormat;
  publisher?: Maybe<Scalars['String']['output']>;
  recordingGroup?: Maybe<RecordingGroup>;
  status: MediaProcessingStatus;
  supplementalFiles: Array<SupplementalFile>;
  thumbnails?: Maybe<Thumbnails>;
  /** Display-title override for this recording (translated/regional/retail title); null means the book's title applies */
  title?: Maybe<Scalars['String']['output']>;
  /** Direct-play audio files, in playback order; empty for media that only has the legacy packaged artifacts below */
  tracks: Array<MediaTrack>;
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
  position: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export enum MediaProcessingStatus {
  Error = 'ERROR',
  Pending = 'PENDING',
  Processing = 'PROCESSING',
  Ready = 'READY'
}

/** One audio file of a recording, played directly by the client */
export type MediaTrack = Node & {
  __typename?: 'MediaTrack';
  /** Audio codec as probed, e.g. "aac". Clients decide playability from this and `mime` — nothing here is assumed playable */
  codec?: Maybe<Scalars['String']['output']>;
  duration: Scalars['Float']['output'];
  /** Container as probed, e.g. "mov,mp4,m4a,3gp,3g2,mj2" */
  format?: Maybe<Scalars['String']['output']>;
  /** The ID of an object */
  id: Scalars['ID']['output'];
  /** Position in the recording's ordered track list, 0-based */
  index: Scalars['Int']['output'];
  insertedAt: Scalars['DateTime']['output'];
  media: Media;
  /** Media type of the file, e.g. "audio/mp4" */
  mime?: Maybe<Scalars['String']['output']>;
  /** Where to fetch the file; requires the same authentication as any other media URL */
  path: Scalars['String']['output'];
  seekAccuracy: SeekAccuracy;
  /** Size in bytes. A float because audiobook files routinely exceed what GraphQL's 32-bit Int can hold */
  size: Scalars['Float']['output'];
  /** Where this track starts on the book's continuous timeline, in seconds. Playback positions are always absolute book-seconds */
  startOffset: Scalars['Float']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

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

export type RecordingGroup = Node & {
  __typename?: 'RecordingGroup';
  /** The work this set covers, same as its members' */
  book: Book;
  /** The ID of an object */
  id: Scalars['ID']['output'];
  insertedAt: Scalars['DateTime']['output'];
  media: Array<Media>;
  /** This set's name, shown to readers only when `show_label` says so */
  name: Scalars['String']['output'];
  /** Wording for one release in this set; null means "part" */
  partWord?: Maybe<Scalars['String']['output']>;
  /** Wording for several releases; null means "parts" */
  partWordPlural?: Maybe<Scalars['String']['output']>;
  /** How many releases the set has, when known ("Part 2 of 3") */
  partsTotal?: Maybe<Scalars['Int']['output']>;
  /** Whether to show `name` on this set's tile; an operator choice, never inferred */
  showLabel: Scalars['Boolean']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type RootMutationType = {
  __typename?: 'RootMutationType';
  createSession?: Maybe<CreateSessionPayload>;
  deleteSession?: Maybe<DeleteSessionPayload>;
  /** V2 sync: events only, no playthroughs. All state is derived from events. */
  syncEvents?: Maybe<SyncEventsPayload>;
};


export type RootMutationTypeCreateSessionArgs = {
  input: CreateSessionInput;
};


export type RootMutationTypeSyncEventsArgs = {
  input: SyncEventsInput;
};

export type RootQueryType = {
  __typename?: 'RootQueryType';
  authorPeopleChangedSince: Array<AuthorPerson>;
  authorsChangedSince: Array<Author>;
  bookAuthorsChangedSince: Array<BookAuthor>;
  bookUniversesChangedSince: Array<BookUniverse>;
  books?: Maybe<BookConnection>;
  booksChangedSince: Array<Book>;
  deletionsSince: Array<Deletion>;
  me?: Maybe<User>;
  mediaChangedSince: Array<Media>;
  mediaNarratorsChangedSince: Array<MediaNarrator>;
  mediaTracksChangedSince: Array<MediaTrack>;
  narratorsChangedSince: Array<Narrator>;
  node?: Maybe<Node>;
  peopleChangedSince: Array<Person>;
  recordingGroupsChangedSince: Array<RecordingGroup>;
  search?: Maybe<SearchResultConnection>;
  seriesBooksChangedSince: Array<SeriesBook>;
  seriesChangedSince: Array<Series>;
  serverTime: Scalars['DateTime']['output'];
  universesChangedSince: Array<Universe>;
};


export type RootQueryTypeAuthorPeopleChangedSinceArgs = {
  since?: InputMaybe<Scalars['DateTime']['input']>;
};


export type RootQueryTypeAuthorsChangedSinceArgs = {
  since?: InputMaybe<Scalars['DateTime']['input']>;
};


export type RootQueryTypeBookAuthorsChangedSinceArgs = {
  since?: InputMaybe<Scalars['DateTime']['input']>;
};


export type RootQueryTypeBookUniversesChangedSinceArgs = {
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


export type RootQueryTypeMediaTracksChangedSinceArgs = {
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


export type RootQueryTypeRecordingGroupsChangedSinceArgs = {
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


export type RootQueryTypeUniversesChangedSinceArgs = {
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

/** How accurately a player can seek within a track */
export enum SeekAccuracy {
  /** The file carries no seek index (e.g. VBR mp3 with no Xing header); positions may drift */
  Approximate = 'APPROXIMATE',
  /** Seeking lands where it says it does */
  Exact = 'EXACT'
}

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
  position: Scalars['Int']['output'];
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

export type Universe = Node & {
  __typename?: 'Universe';
  books: Array<Book>;
  /** The ID of an object */
  id: Scalars['ID']['output'];
  insertedAt: Scalars['DateTime']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type User = {
  __typename?: 'User';
  admin: Scalars['Boolean']['output'];
  confirmedAt?: Maybe<Scalars['DateTime']['output']>;
  email: Scalars['String']['output'];
  insertedAt: Scalars['DateTime']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type LibraryChangesSinceQueryVariables = Exact<{
  since?: InputMaybe<Scalars['DateTime']['input']>;
  deletedSince?: InputMaybe<Scalars['DateTime']['input']>;
}>;


export type LibraryChangesSinceQuery = { __typename?: 'RootQueryType', serverTime: any, peopleChangedSince: Array<{ __typename?: 'Person', id: string, name: string, description?: string | null, insertedAt: any, updatedAt: any, thumbnails?: { __typename?: 'Thumbnails', extraLarge: string, large: string, medium: string, small: string, extraSmall: string, thumbhash: string } | null }>, authorsChangedSince: Array<{ __typename?: 'Author', id: string, name: string, insertedAt: any, updatedAt: any }>, authorPeopleChangedSince: Array<{ __typename?: 'AuthorPerson', id: string, insertedAt: any, updatedAt: any, author: { __typename?: 'Author', id: string }, person: { __typename?: 'Person', id: string } }>, narratorsChangedSince: Array<{ __typename?: 'Narrator', id: string, name: string, insertedAt: any, updatedAt: any, person: { __typename?: 'Person', id: string } }>, booksChangedSince: Array<{ __typename?: 'Book', id: string, title: string, published: any, publishedFormat: DateFormat, insertedAt: any, updatedAt: any }>, bookAuthorsChangedSince: Array<{ __typename?: 'BookAuthor', id: string, position: number, insertedAt: any, updatedAt: any, book: { __typename?: 'Book', id: string }, author: { __typename?: 'Author', id: string } }>, universesChangedSince: Array<{ __typename?: 'Universe', id: string, name: string, insertedAt: any, updatedAt: any }>, bookUniversesChangedSince: Array<{ __typename?: 'BookUniverse', id: string, insertedAt: any, updatedAt: any, book: { __typename?: 'Book', id: string }, universe: { __typename?: 'Universe', id: string } }>, seriesChangedSince: Array<{ __typename?: 'Series', id: string, name: string, insertedAt: any, updatedAt: any }>, seriesBooksChangedSince: Array<{ __typename?: 'SeriesBook', id: string, bookNumber: any, position: number, insertedAt: any, updatedAt: any, book: { __typename?: 'Book', id: string }, series: { __typename?: 'Series', id: string } }>, recordingGroupsChangedSince: Array<{ __typename?: 'RecordingGroup', id: string, name: string, showLabel: boolean, partsTotal?: number | null, partWord?: string | null, partWordPlural?: string | null, insertedAt: any, updatedAt: any, book: { __typename?: 'Book', id: string } }>, mediaChangedSince: Array<{ __typename?: 'Media', id: string, title?: string | null, partNumber?: number | null, status: MediaProcessingStatus, description?: string | null, published?: any | null, publishedFormat: DateFormat, publisher?: string | null, notes?: string | null, abridged: boolean, fullCast: boolean, mp4Path?: string | null, mpdPath?: string | null, hlsPath?: string | null, duration?: number | null, insertedAt: any, updatedAt: any, book: { __typename?: 'Book', id: string }, recordingGroup?: { __typename?: 'RecordingGroup', id: string } | null, thumbnails?: { __typename?: 'Thumbnails', extraLarge: string, large: string, medium: string, small: string, extraSmall: string, thumbhash: string } | null, chapters: Array<{ __typename?: 'Chapter', id: string, title?: string | null, startTime: number, endTime?: number | null }>, supplementalFiles: Array<{ __typename?: 'SupplementalFile', filename: string, label?: string | null, mime: string, path: string }> }>, mediaNarratorsChangedSince: Array<{ __typename?: 'MediaNarrator', id: string, position: number, insertedAt: any, updatedAt: any, media: { __typename?: 'Media', id: string }, narrator: { __typename?: 'Narrator', id: string } }>, mediaTracksChangedSince: Array<{ __typename?: 'MediaTrack', id: string, index: number, path: string, size: number, mime?: string | null, format?: string | null, codec?: string | null, duration: number, startOffset: number, seekAccuracy: SeekAccuracy, insertedAt: any, updatedAt: any, media: { __typename?: 'Media', id: string } }>, deletionsSince: Array<{ __typename?: 'Deletion', type: DeletionType, recordId: string }> };

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