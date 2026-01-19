-- Convert sync-related timestamps from seconds to milliseconds
-- This migration accompanies the schema change from mode: "timestamp" to mode: "timestamp_ms"

-- synced_servers table
UPDATE `synced_servers` SET
  `last_sync_time` = CASE WHEN `last_sync_time` IS NOT NULL THEN `last_sync_time` * 1000 ELSE NULL END,
  `library_data_version` = CASE WHEN `library_data_version` IS NOT NULL THEN `library_data_version` * 1000 ELSE NULL END
WHERE `last_sync_time` IS NULL OR `last_sync_time` < 10000000000;
--> statement-breakpoint

-- server_profiles table
UPDATE `server_profiles` SET
  `last_sync_time` = CASE WHEN `last_sync_time` IS NOT NULL THEN `last_sync_time` * 1000 ELSE NULL END
WHERE `last_sync_time` IS NULL OR `last_sync_time` < 10000000000;
