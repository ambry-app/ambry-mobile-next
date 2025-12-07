import { graphql } from "@/src/graphql/client";
import {
  execute,
  executeAuthenticated,
  ExecuteAuthenticatedError,
  ExecuteError,
  ExecuteErrorCode,
} from "@/src/graphql/client/execute";
import type { SyncProgressInput } from "@/src/graphql/client/graphql";
import { Session } from "@/src/stores/session";
import { Result } from "@/src/types/result";

const libraryChangesSinceQuery = graphql(`
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
`);

export function getLibraryChangesSince(
  session: Session,
  since: Date | null | undefined,
) {
  return executeAuthenticated(
    session.url,
    session.token,
    libraryChangesSinceQuery,
    {
      since,
    },
  );
}

const userChangesSinceQuery = graphql(`
  query UserChangesSince($since: DateTime) {
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
    serverTime
  }
`);

export function getUserChangesSince(
  session: Session,
  since: Date | null | undefined,
) {
  return executeAuthenticated(
    session.url,
    session.token,
    userChangesSinceQuery,
    {
      since,
    },
  );
}

const updatePlayerStateMutation = graphql(`
  mutation UpdatePlayerState($input: UpdatePlayerStateInput!) {
    updatePlayerState(input: $input) {
      playerState {
        updatedAt
      }
    }
  }
`);

export function updatePlayerState(
  session: Session,
  mediaId: string,
  position: number,
  playbackRate: number,
) {
  return executeAuthenticated(
    session.url,
    session.token,
    updatePlayerStateMutation,
    {
      input: {
        mediaId,
        position,
        playbackRate,
      },
    },
  );
}

const createSessionMutation = graphql(`
  mutation CreateSession($input: CreateSessionInput!) {
    createSession(input: $input) {
      token
    }
  }
`);

export enum CreateSessionErrorCode {
  INVALID_CREDENTIALS = "CreateSessionErrorCodeInvalidCredentials",
}

interface InvalidCredentialsError {
  code: CreateSessionErrorCode.INVALID_CREDENTIALS;
}

export type CreateSessionError = InvalidCredentialsError | ExecuteError;

export async function createSession(
  url: string,
  email: string,
  password: string,
): Promise<Result<{ token: string }, CreateSessionError>> {
  const result = await execute(url, createSessionMutation, {
    input: {
      email: email,
      password: password,
    },
  });

  if (!result.success) {
    if (
      result.error.code === ExecuteErrorCode.GQL_ERROR &&
      result.error.message === "invalid username or password"
    ) {
      return {
        success: false,
        error: { code: CreateSessionErrorCode.INVALID_CREDENTIALS },
      };
    }

    return result;
  }

  const {
    result: { createSession },
  } = result;

  const { token } = createSession!;

  return { success: true, result: { token } };
}

const deleteSessionMutation = graphql(`
  mutation DeleteSession {
    deleteSession {
      deleted
    }
  }
`);

// =============================================================================
// Playthrough Sync (new event-sourced model)
// =============================================================================

const syncProgressMutation = graphql(`
  mutation SyncProgress($input: SyncProgressInput!) {
    syncProgress(input: $input) {
      playthroughs {
        id
        status
        startedAt
        finishedAt
        abandonedAt
        deletedAt
        insertedAt
        updatedAt
        media {
          id
        }
      }
      events {
        id
        playthroughId
        deviceId
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
`);

// Re-export generated types for use in sync.ts
export {
  DeviceType,
  PlaybackEventType,
  PlaythroughStatus,
} from "@/src/graphql/client/graphql";
export type { SyncProgressInput } from "@/src/graphql/client/graphql";

export function syncProgress(session: Session, input: SyncProgressInput) {
  return executeAuthenticated(
    session.url,
    session.token,
    syncProgressMutation,
    {
      input,
    },
  );
}

export async function deleteSession(
  url: string,
  token: string,
): Promise<Result<true, ExecuteAuthenticatedError>> {
  const result = await executeAuthenticated(url, token, deleteSessionMutation);

  if (!result.success) {
    return result;
  }

  return { success: true, result: true };
}
