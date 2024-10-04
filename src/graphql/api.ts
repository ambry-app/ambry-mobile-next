import { graphql } from "@/src/graphql/client";
import { executeAuthenticated } from "@/src/graphql/client/execute";
import { Session } from "@/src/stores/session";

const allChangesSinceQuery = graphql(`
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
      abridged
      fullCast
      mp4Path
      mpdPath
      hlsPath
      duration
      # TODO:
      # chapters
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
`);

export function getChangesSince(
  session: Session,
  since: Date | null | undefined,
) {
  return executeAuthenticated(
    session.url,
    session.token,
    allChangesSinceQuery,
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
