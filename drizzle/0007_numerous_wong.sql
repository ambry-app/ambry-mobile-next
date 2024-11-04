CREATE TABLE `local_user_settings` (
	`user_email` text PRIMARY KEY NOT NULL,
	`preferred_playback_rate` real DEFAULT 1 NOT NULL,
	`sleep_timer` integer DEFAULT 600 NOT NULL
);
