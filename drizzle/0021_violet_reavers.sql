ALTER TABLE `playthrough_state_cache` RENAME COLUMN "current_position" TO "position";--> statement-breakpoint
ALTER TABLE `playthroughs` RENAME COLUMN "updated_at" TO "refreshed_at";--> statement-breakpoint
ALTER TABLE `playthrough_state_cache` DROP COLUMN `current_rate`;--> statement-breakpoint
ALTER TABLE `playthrough_state_cache` DROP COLUMN `last_event_at`;--> statement-breakpoint
ALTER TABLE `playthrough_state_cache` DROP COLUMN `total_listening_time`;--> statement-breakpoint
DROP INDEX `playthroughs_synced_at_idx`;--> statement-breakpoint
DELETE FROM `playthroughs` WHERE true;--> statement-breakpoint
ALTER TABLE `playthroughs` ADD `position` real NOT NULL;--> statement-breakpoint
ALTER TABLE `playthroughs` ADD `playback_rate` real NOT NULL;--> statement-breakpoint
ALTER TABLE `playthroughs` ADD `last_event_at` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `playthroughs` DROP COLUMN `created_at`;--> statement-breakpoint
ALTER TABLE `playthroughs` DROP COLUMN `synced_at`;