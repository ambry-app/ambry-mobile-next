/* eslint-disable */
import { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
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

export type CreateSessionInput = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
};

export enum DateFormat {
  Full = 'FULL',
  Year = 'YEAR',
  YearMonth = 'YEAR_MONTH'
}

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

export type LoadPlayerStateInput = {
  mediaId: Scalars['ID']['input'];
};

export enum MediaProcessingStatus {
  Error = 'ERROR',
  Pending = 'PENDING',
  Processing = 'PROCESSING',
  Ready = 'READY'
}

export enum PlayerStateStatus {
  Finished = 'FINISHED',
  InProgress = 'IN_PROGRESS',
  NotStarted = 'NOT_STARTED'
}

export type UpdatePlayerStateInput = {
  mediaId: Scalars['ID']['input'];
  playbackRate?: InputMaybe<Scalars['Float']['input']>;
  position?: InputMaybe<Scalars['Float']['input']>;
};

export type AllChangesSinceQueryVariables = Exact<{
  since?: InputMaybe<Scalars['DateTime']['input']>;
}>;


export type AllChangesSinceQuery = { __typename?: 'RootQueryType', serverTime: any, peopleChangedSince: Array<{ __typename?: 'Person', id: string, name: string, description?: string | null, insertedAt: any, updatedAt: any, thumbnails?: { __typename?: 'Thumbnails', extraLarge: string, large: string, medium: string, small: string, extraSmall: string, thumbhash: string } | null }>, authorsChangedSince: Array<{ __typename?: 'Author', id: string, name: string, insertedAt: any, updatedAt: any, person: { __typename?: 'Person', id: string } }>, narratorsChangedSince: Array<{ __typename?: 'Narrator', id: string, name: string, insertedAt: any, updatedAt: any, person: { __typename?: 'Person', id: string } }>, booksChangedSince: Array<{ __typename?: 'Book', id: string, title: string, published: any, publishedFormat: DateFormat, insertedAt: any, updatedAt: any }>, bookAuthorsChangedSince: Array<{ __typename?: 'BookAuthor', id: string, insertedAt: any, updatedAt: any, book: { __typename?: 'Book', id: string }, author: { __typename?: 'Author', id: string } }>, seriesChangedSince: Array<{ __typename?: 'Series', id: string, name: string, insertedAt: any, updatedAt: any }>, seriesBooksChangedSince: Array<{ __typename?: 'SeriesBook', id: string, bookNumber: any, insertedAt: any, updatedAt: any, book: { __typename?: 'Book', id: string }, series: { __typename?: 'Series', id: string } }>, mediaChangedSince: Array<{ __typename?: 'Media', id: string, status: MediaProcessingStatus, description?: string | null, published?: any | null, publishedFormat: DateFormat, publisher?: string | null, notes?: string | null, abridged: boolean, fullCast: boolean, mp4Path?: string | null, mpdPath?: string | null, hlsPath?: string | null, duration?: number | null, insertedAt: any, updatedAt: any, book: { __typename?: 'Book', id: string }, thumbnails?: { __typename?: 'Thumbnails', extraLarge: string, large: string, medium: string, small: string, extraSmall: string, thumbhash: string } | null, chapters: Array<{ __typename?: 'Chapter', id: string, title?: string | null, startTime: number, endTime?: number | null }>, supplementalFiles: Array<{ __typename?: 'SupplementalFile', filename: string, label?: string | null, mime: string, path: string }> }>, mediaNarratorsChangedSince: Array<{ __typename?: 'MediaNarrator', id: string, insertedAt: any, updatedAt: any, media: { __typename?: 'Media', id: string }, narrator: { __typename?: 'Narrator', id: string } }>, playerStatesChangedSince: Array<{ __typename?: 'PlayerState', id: string, status: PlayerStateStatus, playbackRate: number, position: number, insertedAt: any, updatedAt: any, media: { __typename?: 'Media', id: string } }>, deletionsSince: Array<{ __typename?: 'Deletion', type: DeletionType, recordId: string }> };

export type UpdatePlayerStateMutationVariables = Exact<{
  input: UpdatePlayerStateInput;
}>;


export type UpdatePlayerStateMutation = { __typename?: 'RootMutationType', updatePlayerState?: { __typename?: 'UpdatePlayerStatePayload', playerState: { __typename?: 'PlayerState', updatedAt: any } } | null };

export type CreateSessionMutationVariables = Exact<{
  input: CreateSessionInput;
}>;


export type CreateSessionMutation = { __typename?: 'RootMutationType', createSession?: { __typename?: 'CreateSessionPayload', token: string } | null };

export type DeleteSessionMutationVariables = Exact<{ [key: string]: never; }>;


export type DeleteSessionMutation = { __typename?: 'RootMutationType', deleteSession?: { __typename?: 'DeleteSessionPayload', deleted: boolean } | null };

export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: DocumentTypeDecoration<TResult, TVariables>['__apiType'];

  constructor(private value: string, public __meta__?: Record<string, any>) {
    super(value);
  }

  toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}

export const AllChangesSinceDocument = new TypedDocumentString(`
    query AllChangesSince($since: DateTime) {
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
  playerStatesChangedSince(since: $since) {
    id
    media {
      id
    }
    status
    playbackRate
    position
    insertedAt
    updatedAt
  }
  deletionsSince(since: $since) {
    type
    recordId
  }
  serverTime
}
    `) as unknown as TypedDocumentString<AllChangesSinceQuery, AllChangesSinceQueryVariables>;
export const UpdatePlayerStateDocument = new TypedDocumentString(`
    mutation UpdatePlayerState($input: UpdatePlayerStateInput!) {
  updatePlayerState(input: $input) {
    playerState {
      updatedAt
    }
  }
}
    `) as unknown as TypedDocumentString<UpdatePlayerStateMutation, UpdatePlayerStateMutationVariables>;
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