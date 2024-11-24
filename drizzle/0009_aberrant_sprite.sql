ALTER TABLE `servers` RENAME TO `server_profiles`;--> statement-breakpoint
CREATE TABLE `synced_servers` (
	`url` text PRIMARY KEY NOT NULL,
	`last_down_sync` integer,
	`new_data_as_of` integer
);
--> statement-breakpoint
ALTER TABLE `server_profiles` ADD `new_data_as_of` integer;