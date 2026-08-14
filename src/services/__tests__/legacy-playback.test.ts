/**
 * Legacy transcoded media must keep playing exactly as it does today.
 *
 * Direct-play is unproven until it has run on the fleet, so these tests pin
 * the behaviour every deployed client relies on: the packaged stream, its
 * track type, its headers, and the downloaded mp4. They are here to fail
 * loudly if the direct-play work ever reaches across into the old path.
 */
import { getPlaythroughWithMedia } from "@/db/playthroughs";
import * as trackPlayerService from "@/services/track-player-service";
import { resetForTesting as resetTrackPlayerService } from "@/services/track-player-service";
import { SeekSource } from "@/stores/track-player";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createBook,
  createDownload,
  createMedia,
  createMediaTrack,
  createPlaythrough,
  DEFAULT_TEST_SESSION,
} from "@test/factories";
import { resetTrackPlayerFake, trackPlayerFake } from "@test/jest-setup";

const { getDb } = setupTestDatabase();
const session = DEFAULT_TEST_SESSION;

/** Media as the old transcoding pipeline produces it: no tracks. */
async function legacyRecording(overrides: Record<string, unknown> = {}) {
  const db = getDb();
  const book = await createBook(db, { title: "An Older Book" });
  const media = await createMedia(db, {
    bookId: book.id,
    duration: "3600",
    mpdPath: "/uploads/media-1/dash.mpd",
    hlsPath: "/uploads/media-1/hls.m3u8",
    mp4Path: "/uploads/media-1/file.mp4",
    ...overrides,
  });
  const playthrough = await createPlaythrough(db, {
    mediaId: media.id,
    position: 300,
  });

  return {
    media,
    playthrough: await getPlaythroughWithMedia(session, playthrough.id),
  };
}

/** The single track the player was given. */
function loadedTrack() {
  const queue = trackPlayerFake.getState().queue as Record<string, unknown>[];
  expect(queue).toHaveLength(1);
  return queue[0]!;
}

describe("legacy playback", () => {
  beforeEach(async () => {
    resetTrackPlayerFake();
    await trackPlayerService.initialize();
  });

  afterEach(() => {
    resetTrackPlayerService();
  });

  it("streams the packaged manifest with auth headers", async () => {
    const { playthrough } = await legacyRecording();

    await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

    const track = loadedTrack();
    // jest-expo reports ios, which is the platform that takes the HLS path
    expect(track.url).toBe("http://test-server.com/uploads/media-1/hls.m3u8");
    expect(track.headers).toEqual({
      Authorization: `Bearer ${session.token}`,
    });
  });

  it("keeps the track type every deployed client uses", async () => {
    const { playthrough } = await legacyRecording();

    await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

    // Dash even here, where the URL above is an HLS manifest. The mismatch
    // looks wrong and probably is, but it is what the fleet plays legacy
    // media with, so it stays until the legacy path is retired.
    expect(loadedTrack().type).toBe("dash");
  });

  it("reports the media's own duration", async () => {
    const { playthrough } = await legacyRecording();

    await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

    expect(loadedTrack().duration).toBe(3600);
  });

  it("opens where the listener left off and seeks normally", async () => {
    const { playthrough } = await legacyRecording();

    await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);
    expect((await trackPlayerService.getAccurateProgress()).position).toBe(300);

    await trackPlayerService.seekTo(1500, SeekSource.SCRUBBER);
    expect((await trackPlayerService.getAccurateProgress()).position).toBe(
      1500,
    );

    // no queue juggling for media that is a single stream
    expect(trackPlayerFake.getState().activeTrackIndex).toBe(0);
  });

  it("plays a downloaded mp4 from disk, with no track type", async () => {
    const db = getDb();
    const { media, playthrough: created } = await legacyRecording();
    await createDownload(db, {
      mediaId: media.id,
      filePath: "media-1.mp4",
      status: "ready",
    });

    const playthrough = await getPlaythroughWithMedia(session, created.id);
    await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

    const track = loadedTrack();
    expect(track.url).toBe("file:///test-document-directory/media-1.mp4");
    // local files are handed over without a type, as they always have been
    expect(track.type).toBeUndefined();
    expect(track.headers).toBeUndefined();
  });

  it("still resolves a download recorded as an absolute path", async () => {
    const db = getDb();
    const { media, playthrough: created } = await legacyRecording();
    // how downloads were stored before paths became relative
    await createDownload(db, {
      mediaId: media.id,
      filePath: "file:///old-container/media-1.mp4",
      status: "ready",
    });

    const playthrough = await getPlaythroughWithMedia(session, created.id);
    await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

    expect(loadedTrack().url).toBe(
      "file:///test-document-directory/media-1.mp4",
    );
  });

  it("prefers direct-play once a recording has tracks", async () => {
    const db = getDb();
    const { media, playthrough: created } = await legacyRecording();
    await createMediaTrack(db, {
      mediaId: media.id,
      index: 0,
      startOffset: 0,
      duration: 3600,
      path: "/files/book/whole.m4b",
    });

    const playthrough = await getPlaythroughWithMedia(session, created.id);
    await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

    expect(loadedTrack().url).toBe(
      "http://test-server.com/files/book/whole.m4b",
    );
  });
});
