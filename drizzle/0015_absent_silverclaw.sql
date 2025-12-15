ALTER TABLE `synced_servers` RENAME COLUMN "last_down_sync" TO "last_sync_time";--> statement-breakpoint
ALTER TABLE `synced_servers` RENAME COLUMN "new_data_as_of" TO "library_data_version";--> statement-breakpoint
ALTER TABLE `server_profiles` ADD `last_sync_time` integer;--> statement-breakpoint
ALTER TABLE `server_profiles` DROP COLUMN `last_down_sync`;--> statement-breakpoint
ALTER TABLE `server_profiles` DROP COLUMN `new_data_as_of`;--> statement-breakpoint
ALTER TABLE `server_profiles` DROP COLUMN `last_up_sync`;