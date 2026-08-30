-- 0029 added `unlisted_at` to media. The server only re-sends rows whose
-- updated_at is newer than last_sync_time, so audiobooks unlisted before this
-- device gained the column would stay listed here forever. This asks the next
-- sync to re-fetch every entity; the deletions cursor is deliberately left
-- alone, same reasoning as 0028.
UPDATE `synced_servers` SET `needs_full_refetch` = true;
