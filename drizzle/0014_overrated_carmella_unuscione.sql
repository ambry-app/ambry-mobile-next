CREATE TABLE `playback_events` (
	`id` text PRIMARY KEY NOT NULL,
	`playthrough_id` text NOT NULL,
	`device_id` text,
	`type` text NOT NULL,
	`timestamp` integer NOT NULL,
	`position` real,
	`playback_rate` real,
	`from_position` real,
	`to_position` real,
	`previous_rate` real,
	`synced_at` integer
);
--> statement-breakpoint
CREATE INDEX `playback_events_playthrough_timestamp_idx` ON `playback_events` (`playthrough_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `playback_events_synced_at_idx` ON `playback_events` (`synced_at`);--> statement-breakpoint
CREATE TABLE `playthrough_state_cache` (
	`playthrough_id` text PRIMARY KEY NOT NULL,
	`current_position` real NOT NULL,
	`current_rate` real NOT NULL,
	`last_event_at` integer NOT NULL,
	`total_listening_time` real,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `playthroughs` (
	`id` text NOT NULL,
	`url` text NOT NULL,
	`user_email` text NOT NULL,
	`media_id` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`abandoned_at` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`synced_at` integer,
	PRIMARY KEY(`url`, `id`),
	FOREIGN KEY (`url`,`media_id`) REFERENCES `media`(`url`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `playthroughs_user_media_idx` ON `playthroughs` (`url`,`user_email`,`media_id`);--> statement-breakpoint
CREATE INDEX `playthroughs_synced_at_idx` ON `playthroughs` (`synced_at`);