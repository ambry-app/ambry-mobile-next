import { graphql } from "@/graphql/client";
import {
  execute,
  executeAuthenticated,
  ExecuteAuthenticatedError,
  ExecuteError,
  ExecuteErrorCode,
} from "@/graphql/client/execute";
import {
  DeviceTypeInput,
  PlaybackEventType,
  type SyncEventsInput,
} from "@/graphql/client/graphql";
import { Result } from "@/types/result";
import { Session } from "@/types/session";

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
// Playthrough Sync (V2 - events only)
// =============================================================================

const syncEventsMutation = graphql(`
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
`);

// Re-export generated types for use in sync-service.ts
export type { SyncEventsInput };
export { DeviceTypeInput, PlaybackEventType };

export function syncEvents(session: Session, input: SyncEventsInput) {
  return executeAuthenticated(session.url, session.token, syncEventsMutation, {
    input,
  });
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
