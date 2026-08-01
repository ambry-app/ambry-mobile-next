/**
 * Tests for the migration that collapses the per-email `local_user_settings`
 * table into the device-scoped `local_settings` singleton.
 *
 * Applies all migrations up to (but not including) the collapse migration,
 * seeds legacy data, then applies the collapse migration and verifies the
 * surviving row.
 */
import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

const MIGRATIONS_DIR = path.join(__dirname, "../../../drizzle");
const COLLAPSE_MIGRATION_PREFIX = "0023_";

function readJournalTags(): string[] {
  const journalPath = path.join(MIGRATIONS_DIR, "meta/_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
  return journal.entries.map((entry: { tag: string }) => entry.tag);
}

function applyMigration(sqlite: Database.Database, tag: string): void {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, `${tag}.sql`), "utf-8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    sqlite.exec(statement);
  }
}

/**
 * Create an in-memory database migrated up to, but not including, the
 * collapse migration. Returns the database and the collapse migration's tag.
 */
function createLegacyDatabase(): {
  sqlite: Database.Database;
  collapseTag: string;
} {
  const tags = readJournalTags();
  const collapseTag = tags.find((tag) =>
    tag.startsWith(COLLAPSE_MIGRATION_PREFIX),
  )!;
  expect(collapseTag).toBeDefined();

  const sqlite = new Database(":memory:");
  for (const tag of tags) {
    if (tag === collapseTag) break;
    applyMigration(sqlite, tag);
  }

  return { sqlite, collapseTag };
}

function insertLegacySettings(
  sqlite: Database.Database,
  userEmail: string,
  rate: number,
  sleepTimer: number,
): void {
  sqlite
    .prepare(
      `INSERT INTO local_user_settings
         (user_email, preferred_playback_rate, sleep_timer, sleep_timer_enabled, sleep_timer_motion_detection_enabled)
       VALUES (?, ?, ?, 1, 0)`,
    )
    .run(userEmail, rate, sleepTimer);
}

function insertServerProfile(
  sqlite: Database.Database,
  url: string,
  userEmail: string,
  lastSyncTime: number | null,
): void {
  sqlite
    .prepare(
      `INSERT INTO server_profiles (url, user_email, last_sync_time) VALUES (?, ?, ?)`,
    )
    .run(url, userEmail, lastSyncTime);
}

function getLocalSettingsRows(sqlite: Database.Database) {
  return sqlite.prepare(`SELECT * FROM local_settings`).all() as {
    id: string;
    preferred_playback_rate: number;
    sleep_timer: number;
    sleep_timer_enabled: number;
    sleep_timer_motion_detection_enabled: number;
    sleep_timer_trigger_time: number | null;
  }[];
}

describe("local settings collapse migration", () => {
  it("drops the legacy table and leaves the new table empty on a fresh install", () => {
    const { sqlite, collapseTag } = createLegacyDatabase();

    applyMigration(sqlite, collapseTag);

    expect(getLocalSettingsRows(sqlite)).toHaveLength(0);
    expect(() => sqlite.exec("SELECT * FROM local_user_settings")).toThrow();
    sqlite.close();
  });

  it("carries over the single existing settings row", () => {
    const { sqlite, collapseTag } = createLegacyDatabase();
    insertLegacySettings(sqlite, "user@example.com", 1.25, 600);

    applyMigration(sqlite, collapseTag);

    const rows = getLocalSettingsRows(sqlite);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe("local");
    expect(rows[0]!.preferred_playback_rate).toBe(1.25);
    expect(rows[0]!.sleep_timer).toBe(600);
    expect(rows[0]!.sleep_timer_enabled).toBe(1);
    sqlite.close();
  });

  it("keeps the row of the most recently synced account when several exist", () => {
    const { sqlite, collapseTag } = createLegacyDatabase();
    // stale@example.com signed in most recently (higher rowid) but
    // active@example.com synced more recently
    insertLegacySettings(sqlite, "active@example.com", 1.5, 900);
    insertLegacySettings(sqlite, "stale@example.com", 2.0, 300);
    insertServerProfile(
      sqlite,
      "https://a.example",
      "active@example.com",
      2000,
    );
    insertServerProfile(sqlite, "https://b.example", "stale@example.com", 1000);

    applyMigration(sqlite, collapseTag);

    const rows = getLocalSettingsRows(sqlite);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.preferred_playback_rate).toBe(1.5);
    expect(rows[0]!.sleep_timer).toBe(900);
    sqlite.close();
  });

  it("falls back to the most recently created row when no profiles exist", () => {
    const { sqlite, collapseTag } = createLegacyDatabase();
    insertLegacySettings(sqlite, "old@example.com", 1.0, 300);
    insertLegacySettings(sqlite, "new@example.com", 1.75, 1200);

    applyMigration(sqlite, collapseTag);

    const rows = getLocalSettingsRows(sqlite);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.preferred_playback_rate).toBe(1.75);
    expect(rows[0]!.sleep_timer).toBe(1200);
    sqlite.close();
  });

  it("prefers a synced account over accounts that never synced", () => {
    const { sqlite, collapseTag } = createLegacyDatabase();
    insertLegacySettings(sqlite, "synced@example.com", 1.5, 900);
    insertLegacySettings(sqlite, "never-synced@example.com", 2.0, 300);
    insertServerProfile(
      sqlite,
      "https://a.example",
      "synced@example.com",
      2000,
    );
    insertServerProfile(
      sqlite,
      "https://b.example",
      "never-synced@example.com",
      null,
    );

    applyMigration(sqlite, collapseTag);

    const rows = getLocalSettingsRows(sqlite);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.preferred_playback_rate).toBe(1.5);
    sqlite.close();
  });
});
