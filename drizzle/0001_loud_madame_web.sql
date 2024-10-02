CREATE TABLE `local_player_states` (
	`url` text NOT NULL,
	`media_id` text NOT NULL,
	`user_email` text NOT NULL,
	`playback_rate` real NOT NULL,
	`position` real NOT NULL,
	`status` text NOT NULL,
	`inserted_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`url`, `media_id`, `user_email`),
	FOREIGN KEY (`url`,`media_id`) REFERENCES `media`(`url`,`id`) ON UPDATE no action ON DELETE cascade
);
