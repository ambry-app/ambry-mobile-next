/* eslint-disable */
import * as types from './graphql';



/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query LibraryChangesSince($since: DateTime) {\n    peopleChangedSince(since: $since) {\n      id\n      name\n      description\n      thumbnails {\n        extraLarge\n        large\n        medium\n        small\n        extraSmall\n        thumbhash\n      }\n      insertedAt\n      updatedAt\n    }\n    authorsChangedSince(since: $since) {\n      id\n      person {\n        id\n      }\n      name\n      insertedAt\n      updatedAt\n    }\n    narratorsChangedSince(since: $since) {\n      id\n      person {\n        id\n      }\n      name\n      insertedAt\n      updatedAt\n    }\n    booksChangedSince(since: $since) {\n      id\n      title\n      published\n      publishedFormat\n      insertedAt\n      updatedAt\n    }\n    bookAuthorsChangedSince(since: $since) {\n      id\n      book {\n        id\n      }\n      author {\n        id\n      }\n      insertedAt\n      updatedAt\n    }\n    seriesChangedSince(since: $since) {\n      id\n      name\n      insertedAt\n      updatedAt\n    }\n    seriesBooksChangedSince(since: $since) {\n      id\n      book {\n        id\n      }\n      series {\n        id\n      }\n      bookNumber\n      insertedAt\n      updatedAt\n    }\n    mediaChangedSince(since: $since) {\n      id\n      book {\n        id\n      }\n      status\n      description\n      thumbnails {\n        extraLarge\n        large\n        medium\n        small\n        extraSmall\n        thumbhash\n      }\n      published\n      publishedFormat\n      publisher\n      notes\n      abridged\n      fullCast\n      mp4Path\n      mpdPath\n      hlsPath\n      duration\n      chapters {\n        id\n        title\n        startTime\n        endTime\n      }\n      supplementalFiles {\n        filename\n        label\n        mime\n        path\n      }\n      insertedAt\n      updatedAt\n    }\n    mediaNarratorsChangedSince(since: $since) {\n      id\n      media {\n        id\n      }\n      narrator {\n        id\n      }\n      insertedAt\n      updatedAt\n    }\n    deletionsSince(since: $since) {\n      type\n      recordId\n    }\n    serverTime\n  }\n": typeof types.LibraryChangesSinceDocument,
    "\n  query UserChangesSince($since: DateTime) {\n    playerStatesChangedSince(since: $since) {\n      id\n      media {\n        id\n      }\n      status\n      playbackRate\n      position\n      insertedAt\n      updatedAt\n    }\n    serverTime\n  }\n": typeof types.UserChangesSinceDocument,
    "\n  mutation UpdatePlayerState($input: UpdatePlayerStateInput!) {\n    updatePlayerState(input: $input) {\n      playerState {\n        updatedAt\n      }\n    }\n  }\n": typeof types.UpdatePlayerStateDocument,
    "\n  mutation CreateSession($input: CreateSessionInput!) {\n    createSession(input: $input) {\n      token\n    }\n  }\n": typeof types.CreateSessionDocument,
    "\n  mutation DeleteSession {\n    deleteSession {\n      deleted\n    }\n  }\n": typeof types.DeleteSessionDocument,
};
const documents: Documents = {
    "\n  query LibraryChangesSince($since: DateTime) {\n    peopleChangedSince(since: $since) {\n      id\n      name\n      description\n      thumbnails {\n        extraLarge\n        large\n        medium\n        small\n        extraSmall\n        thumbhash\n      }\n      insertedAt\n      updatedAt\n    }\n    authorsChangedSince(since: $since) {\n      id\n      person {\n        id\n      }\n      name\n      insertedAt\n      updatedAt\n    }\n    narratorsChangedSince(since: $since) {\n      id\n      person {\n        id\n      }\n      name\n      insertedAt\n      updatedAt\n    }\n    booksChangedSince(since: $since) {\n      id\n      title\n      published\n      publishedFormat\n      insertedAt\n      updatedAt\n    }\n    bookAuthorsChangedSince(since: $since) {\n      id\n      book {\n        id\n      }\n      author {\n        id\n      }\n      insertedAt\n      updatedAt\n    }\n    seriesChangedSince(since: $since) {\n      id\n      name\n      insertedAt\n      updatedAt\n    }\n    seriesBooksChangedSince(since: $since) {\n      id\n      book {\n        id\n      }\n      series {\n        id\n      }\n      bookNumber\n      insertedAt\n      updatedAt\n    }\n    mediaChangedSince(since: $since) {\n      id\n      book {\n        id\n      }\n      status\n      description\n      thumbnails {\n        extraLarge\n        large\n        medium\n        small\n        extraSmall\n        thumbhash\n      }\n      published\n      publishedFormat\n      publisher\n      notes\n      abridged\n      fullCast\n      mp4Path\n      mpdPath\n      hlsPath\n      duration\n      chapters {\n        id\n        title\n        startTime\n        endTime\n      }\n      supplementalFiles {\n        filename\n        label\n        mime\n        path\n      }\n      insertedAt\n      updatedAt\n    }\n    mediaNarratorsChangedSince(since: $since) {\n      id\n      media {\n        id\n      }\n      narrator {\n        id\n      }\n      insertedAt\n      updatedAt\n    }\n    deletionsSince(since: $since) {\n      type\n      recordId\n    }\n    serverTime\n  }\n": types.LibraryChangesSinceDocument,
    "\n  query UserChangesSince($since: DateTime) {\n    playerStatesChangedSince(since: $since) {\n      id\n      media {\n        id\n      }\n      status\n      playbackRate\n      position\n      insertedAt\n      updatedAt\n    }\n    serverTime\n  }\n": types.UserChangesSinceDocument,
    "\n  mutation UpdatePlayerState($input: UpdatePlayerStateInput!) {\n    updatePlayerState(input: $input) {\n      playerState {\n        updatedAt\n      }\n    }\n  }\n": types.UpdatePlayerStateDocument,
    "\n  mutation CreateSession($input: CreateSessionInput!) {\n    createSession(input: $input) {\n      token\n    }\n  }\n": types.CreateSessionDocument,
    "\n  mutation DeleteSession {\n    deleteSession {\n      deleted\n    }\n  }\n": types.DeleteSessionDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query LibraryChangesSince($since: DateTime) {\n    peopleChangedSince(since: $since) {\n      id\n      name\n      description\n      thumbnails {\n        extraLarge\n        large\n        medium\n        small\n        extraSmall\n        thumbhash\n      }\n      insertedAt\n      updatedAt\n    }\n    authorsChangedSince(since: $since) {\n      id\n      person {\n        id\n      }\n      name\n      insertedAt\n      updatedAt\n    }\n    narratorsChangedSince(since: $since) {\n      id\n      person {\n        id\n      }\n      name\n      insertedAt\n      updatedAt\n    }\n    booksChangedSince(since: $since) {\n      id\n      title\n      published\n      publishedFormat\n      insertedAt\n      updatedAt\n    }\n    bookAuthorsChangedSince(since: $since) {\n      id\n      book {\n        id\n      }\n      author {\n        id\n      }\n      insertedAt\n      updatedAt\n    }\n    seriesChangedSince(since: $since) {\n      id\n      name\n      insertedAt\n      updatedAt\n    }\n    seriesBooksChangedSince(since: $since) {\n      id\n      book {\n        id\n      }\n      series {\n        id\n      }\n      bookNumber\n      insertedAt\n      updatedAt\n    }\n    mediaChangedSince(since: $since) {\n      id\n      book {\n        id\n      }\n      status\n      description\n      thumbnails {\n        extraLarge\n        large\n        medium\n        small\n        extraSmall\n        thumbhash\n      }\n      published\n      publishedFormat\n      publisher\n      notes\n      abridged\n      fullCast\n      mp4Path\n      mpdPath\n      hlsPath\n      duration\n      chapters {\n        id\n        title\n        startTime\n        endTime\n      }\n      supplementalFiles {\n        filename\n        label\n        mime\n        path\n      }\n      insertedAt\n      updatedAt\n    }\n    mediaNarratorsChangedSince(since: $since) {\n      id\n      media {\n        id\n      }\n      narrator {\n        id\n      }\n      insertedAt\n      updatedAt\n    }\n    deletionsSince(since: $since) {\n      type\n      recordId\n    }\n    serverTime\n  }\n"): typeof import('./graphql').LibraryChangesSinceDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query UserChangesSince($since: DateTime) {\n    playerStatesChangedSince(since: $since) {\n      id\n      media {\n        id\n      }\n      status\n      playbackRate\n      position\n      insertedAt\n      updatedAt\n    }\n    serverTime\n  }\n"): typeof import('./graphql').UserChangesSinceDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdatePlayerState($input: UpdatePlayerStateInput!) {\n    updatePlayerState(input: $input) {\n      playerState {\n        updatedAt\n      }\n    }\n  }\n"): typeof import('./graphql').UpdatePlayerStateDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateSession($input: CreateSessionInput!) {\n    createSession(input: $input) {\n      token\n    }\n  }\n"): typeof import('./graphql').CreateSessionDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteSession {\n    deleteSession {\n      deleted\n    }\n  }\n"): typeof import('./graphql').DeleteSessionDocument;


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
