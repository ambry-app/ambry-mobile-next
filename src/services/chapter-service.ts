import { SeekSource } from "@/stores/player-ui-state";

import { seekTo } from "./seek-service";
import * as Player from "./track-player-service";

/**
 * Skip to the end of the current chapter.
 * If it's the last chapter, it will seek to the end of the media.
 */
export function skipToEndOfChapter() {
  const currentChapter = Player.getCurrentChapter();

  if (!currentChapter) return;

  const { duration } = Player.getProgress();
  const newPosition = currentChapter.endTime ?? duration;

  return seekTo(newPosition, SeekSource.CHAPTER);
}

/**
 * Skip to the beginning of the chapter.
 * - If playback is within the first few seconds of a chapter, it skips to the previous chapter.
 * - Otherwise, it skips to the beginning of the current chapter.
 */
export function skipToBeginningOfChapter() {
  const currentChapter = Player.getCurrentChapter();

  if (!currentChapter) return;

  const previousChapter = Player.getPreviousChapter();
  const { position } = Player.getProgress();

  // If we are at the very start of the chapter, go to the previous one.
  // The threshold (e.g., 2 seconds) prevents accidental double-taps from
  // skipping two chapters.
  const isAtChapterStart = position - currentChapter.startTime < 2;

  const newPosition = isAtChapterStart
    ? (previousChapter?.startTime ?? 0)
    : currentChapter.startTime;

  return seekTo(newPosition, SeekSource.CHAPTER);
}
