/**
 * A multi-file recording must be indistinguishable from a single-file one
 * everywhere above the track player wrapper. These tests drive the real
 * service against the track player fake and assert in book seconds, which is
 * the only coordinate system the rest of the app knows about.
 */
import { getPlaythroughWithMedia } from "@/db/playthroughs";
import * as trackPlayerService from "@/services/track-player-service";
import { resetForTesting as resetTrackPlayerService } from "@/services/track-player-service";
import { SeekSource, useTrackPlayer } from "@/stores/track-player";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createBook,
  createMedia,
  createMediaTrack,
  createPlaythrough,
  DEFAULT_TEST_SESSION,
} from "@test/factories";
import { resetTrackPlayerFake, trackPlayerFake } from "@test/jest-setup";

const { getDb } = setupTestDatabase();
const session = DEFAULT_TEST_SESSION;

/** Three files of an hour, half an hour and an hour: a 2.5 hour book. */
async function threePartRecording(position = 0) {
  const db = getDb();
  const book = await createBook(db, { title: "Leviathan Wakes" });
  const media = await createMedia(db, {
    bookId: book.id,
    duration: "9000",
    mp4Path: null,
  });

  const offsets = [
    { index: 0, startOffset: 0, duration: 3600 },
    { index: 1, startOffset: 3600, duration: 1800 },
    { index: 2, startOffset: 5400, duration: 3600 },
  ];
  for (const offset of offsets) {
    await createMediaTrack(db, {
      mediaId: media.id,
      path: `/files/book/${offset.index}.m4b`,
      ...offset,
    });
  }

  const playthrough = await createPlaythrough(db, {
    mediaId: media.id,
    position,
  });

  return getPlaythroughWithMedia(session, playthrough.id);
}

describe("multi-file playback", () => {
  beforeEach(async () => {
    resetTrackPlayerFake();
    await trackPlayerService.initialize();
  });

  afterEach(() => {
    resetTrackPlayerService();
  });

  it("reports the book's duration, not the current file's", async () => {
    const playthrough = await threePartRecording();

    await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

    const { duration } = await trackPlayerService.getAccurateProgress();
    expect(duration).toBe(9000);
  });

  it("opens at a position inside a later file as a book position", async () => {
    // 2 hours in: 1800 seconds into the third file
    const playthrough = await threePartRecording(7200);

    await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

    const { position } = await trackPlayerService.getAccurateProgress();
    expect(position).toBe(7200);

    // the player itself is on the third file, near its start
    expect(trackPlayerFake.getState().activeTrackIndex).toBe(2);
    expect(trackPlayerFake.getState().position).toBe(1800);
  });

  it("seeks across a file boundary without the caller knowing", async () => {
    const playthrough = await threePartRecording(60);
    await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

    // from the first file into the second
    await trackPlayerService.seekTo(4000, SeekSource.SCRUBBER);

    const { position } = await trackPlayerService.getAccurateProgress();
    expect(position).toBe(4000);
    expect(trackPlayerFake.getState().activeTrackIndex).toBe(1);
    expect(trackPlayerFake.getState().position).toBe(400);
  });

  it("seeks within the current file without switching files", async () => {
    const playthrough = await threePartRecording(4000);
    await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

    await trackPlayerService.seekTo(5000, SeekSource.SCRUBBER);

    expect(trackPlayerFake.getState().activeTrackIndex).toBe(1);
    const { position } = await trackPlayerService.getAccurateProgress();
    expect(position).toBe(5000);
  });

  it("seeks backwards across a boundary", async () => {
    const playthrough = await threePartRecording(6000);
    await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);
    expect(trackPlayerFake.getState().activeTrackIndex).toBe(2);

    await trackPlayerService.seekTo(100, SeekSource.SCRUBBER);

    expect(trackPlayerFake.getState().activeTrackIndex).toBe(0);
    const { position } = await trackPlayerService.getAccurateProgress();
    expect(position).toBe(100);
  });

  it("records seek events in book seconds", async () => {
    const playthrough = await threePartRecording(60);
    await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

    await trackPlayerService.seekTo(8000, SeekSource.SCRUBBER);

    // the event log is shared with the server and with single-file
    // recordings, so it can only ever speak book seconds
    const { lastSeek } = useTrackPlayer.getState();
    expect(lastSeek?.from).toBe(60);
    expect(lastSeek?.to).toBe(8000);
  });

  it("leaves a single-file recording exactly as it was", async () => {
    const db = getDb();
    const book = await createBook(db);
    const media = await createMedia(db, {
      bookId: book.id,
      duration: "5400",
      mp4Path: null,
    });
    await createMediaTrack(db, {
      mediaId: media.id,
      index: 0,
      startOffset: 0,
      duration: 5400,
      path: "/files/book/whole.m4b",
    });
    const created = await createPlaythrough(db, {
      mediaId: media.id,
      position: 1200,
    });
    const playthrough = await getPlaythroughWithMedia(session, created.id);

    await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);
    await trackPlayerService.seekTo(3000, SeekSource.SCRUBBER);

    const { position, duration } =
      await trackPlayerService.getAccurateProgress();
    expect(position).toBe(3000);
    expect(duration).toBe(5400);
    expect(trackPlayerFake.getState().activeTrackIndex).toBe(0);
  });
});
