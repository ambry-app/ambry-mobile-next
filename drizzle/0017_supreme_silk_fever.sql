-- Convert playthrough timestamps from seconds to milliseconds
-- This migration accompanies the schema change from mode: "timestamp" to mode: "timestamp_ms"

-- playthroughs table
UPDATE `playthroughs` SET
  `started_at` = `started_at` * 1000,
  `finished_at` = CASE WHEN `finished_at` IS NOT NULL THEN `finished_at` * 1000 ELSE NULL END,
  `abandoned_at` = CASE WHEN `abandoned_at` IS NOT NULL THEN `abandoned_at` * 1000 ELSE NULL END,
  `deleted_at` = CASE WHEN `deleted_at` IS NOT NULL THEN `deleted_at` * 1000 ELSE NULL END,
  `created_at` = `created_at` * 1000,
  `updated_at` = `updated_at` * 1000,
  `synced_at` = CASE WHEN `synced_at` IS NOT NULL THEN `synced_at` * 1000 ELSE NULL END
WHERE `started_at` < 10000000000;
--> statement-breakpoint

-- playback_events table
UPDATE `playback_events` SET
  `timestamp` = `timestamp` * 1000,
  `synced_at` = CASE WHEN `synced_at` IS NOT NULL THEN `synced_at` * 1000 ELSE NULL END
WHERE `timestamp` < 10000000000;
--> statement-breakpoint

-- playthrough_state_cache table
UPDATE `playthrough_state_cache` SET
  `last_event_at` = `last_event_at` * 1000,
  `updated_at` = `updated_at` * 1000
WHERE `last_event_at` < 10000000000;
