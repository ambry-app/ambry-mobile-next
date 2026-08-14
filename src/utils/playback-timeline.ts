/**
 * Mapping between a book's continuous timeline and the files it is made of.
 *
 * A direct-play recording can be one file or forty. Everything above the track
 * player — events, the heartbeat, chapters, seeking, the scrubber — works in
 * absolute book seconds and must never learn otherwise, so this is the only
 * place the two coordinate systems meet.
 *
 * `startOffset` is authoritative: the server computed where each file begins on
 * the book's timeline, so positions are derived from it rather than by summing
 * durations, which would drift if files ever overlap or leave a gap.
 */

export type TimelineTrack = {
  startOffset: number;
  duration: number;
};

/** Where a book position falls: which file, and how far into it. */
export type TrackPosition = {
  index: number;
  position: number;
};

/**
 * How long the book is, from its last file's end.
 */
export function bookDuration(tracks: TimelineTrack[]): number {
  const last = tracks[tracks.length - 1];
  if (!last) return 0;

  return last.startOffset + last.duration;
}

/**
 * Which file holds a given book position.
 *
 * Positions outside the book clamp to its ends rather than throwing: a player
 * reporting a position slightly past the last file's end is normal at the end
 * of playback, and a negative position is what a rewind past the start
 * produces.
 */
export function trackAt(
  tracks: TimelineTrack[],
  bookPosition: number,
): TrackPosition {
  if (tracks.length === 0) return { index: 0, position: 0 };

  if (!(bookPosition > 0)) return { index: 0, position: 0 };

  // Walk backwards to the first file that starts at or before this position.
  // Boundaries belong to the later file, so the end of file 1 and the start of
  // file 2 resolve to the same place: the start of file 2.
  for (let index = tracks.length - 1; index >= 0; index--) {
    const track = tracks[index]!;

    if (bookPosition >= track.startOffset) {
      return {
        index,
        position: Math.min(bookPosition - track.startOffset, track.duration),
      };
    }
  }

  return { index: 0, position: 0 };
}

/**
 * Where a position inside a file falls on the book's timeline.
 */
export function bookPositionOf(
  tracks: TimelineTrack[],
  index: number,
  trackPosition: number,
): number {
  const track = tracks[index];
  if (!track) return trackPosition;

  return track.startOffset + trackPosition;
}
