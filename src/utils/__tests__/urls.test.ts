import { serverUrl } from "@/utils/urls";

const base = "http://192.168.0.45:4000";

describe("serverUrl", () => {
  it("encodes spaces, which is what broke downloading", () => {
    expect(
      serverUrl(base, "/files/track/x9/This Is How You Lose the Time War.mp3"),
    ).toBe(
      "http://192.168.0.45:4000/files/track/x9/This%20Is%20How%20You%20Lose%20the%20Time%20War.mp3",
    );
  });

  it("encodes the other characters real filenames carry", () => {
    expect(serverUrl(base, "/files/a/Bookshops & Bonedust [nR].m4b")).toBe(
      "http://192.168.0.45:4000/files/a/Bookshops%20%26%20Bonedust%20%5BnR%5D.m4b",
    );
  });

  it("encodes characters that would otherwise change what the URL means", () => {
    // a # would start a fragment and silently truncate the path
    expect(serverUrl(base, "/files/a/Track #3.mp3")).toBe(
      "http://192.168.0.45:4000/files/a/Track%20%233.mp3",
    );
    expect(serverUrl(base, "/files/a/what?.mp3")).toBe(
      "http://192.168.0.45:4000/files/a/what%3F.mp3",
    );
  });

  it("keeps the separators", () => {
    expect(serverUrl(base, "/files/track/x9/name.mp3")).toBe(
      "http://192.168.0.45:4000/files/track/x9/name.mp3",
    );
  });

  it("leaves legacy paths byte-for-byte identical", () => {
    // the one path every deployed client already streams
    for (const path of [
      "/uploads/media-1/dash.mpd",
      "/uploads/media-1/hls.m3u8",
      "/uploads/media-1/file.mp4",
    ]) {
      expect(serverUrl(base, path)).toBe(`${base}${path}`);
    }
  });

  it("does not care whether the slashes are there", () => {
    const expected = "http://192.168.0.45:4000/files/a.mp3";

    expect(serverUrl(base, "/files/a.mp3")).toBe(expected);
    expect(serverUrl(base, "files/a.mp3")).toBe(expected);
    expect(serverUrl(`${base}/`, "/files/a.mp3")).toBe(expected);
    expect(serverUrl(`${base}//`, "files/a.mp3")).toBe(expected);
  });

  it("handles non-ascii names", () => {
    expect(serverUrl(base, "/files/a/Solaris — Lem.mp3")).toBe(
      "http://192.168.0.45:4000/files/a/Solaris%20%E2%80%94%20Lem.mp3",
    );
  });

  it("encodes a literal percent rather than trusting it", () => {
    // a filename may genuinely contain %, and it must not be read as an
    // escape sequence
    expect(serverUrl(base, "/files/a/100% Proof.mp3")).toBe(
      "http://192.168.0.45:4000/files/a/100%25%20Proof.mp3",
    );
  });
});
