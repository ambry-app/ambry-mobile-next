/**
 * The vocabulary half of the content policy in AGENTS.md, enforced rather
 * than remembered.
 */
import { execFileSync } from "child_process";
import { readFileSync } from "fs";

const BANNED =
  /torrent|usenet|\bnzb\b|magnet:\?/i;
const SELF = "test/content-policy.test.ts";

test("no file in the repository names an acquisition tool or network", () => {
  const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter((file) => file && file !== SELF && file !== "package-lock.json");

  const offenders = files.flatMap((file) => {
    let bytes: Buffer;
    try {
      bytes = readFileSync(file);
    } catch {
      return [];
    }
    if (bytes.includes(0)) return [];
    return bytes
      .toString("utf8")
      .split("\n")
      .filter((line) => BANNED.test(line))
      .map((line) => `${file}: ${line.trim()}`);
  });

  expect(offenders).toEqual([]);
});
