ALTER TABLE `servers` RENAME COLUMN `last_sync` TO `last_down_sync`;--> statement-breakpoint
ALTER TABLE `servers` ADD `last_up_sync` integer;