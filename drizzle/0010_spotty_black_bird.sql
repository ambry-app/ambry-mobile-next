CREATE TABLE `shelved_media` (
	`url` text NOT NULL,
	`user_email` text NOT NULL,
	`shelf_name` text NOT NULL,
	`media_id` text NOT NULL,
	`added_at` integer NOT NULL,
	`deleted_at` integer,
	`priority` integer NOT NULL,
	`synced` integer NOT NULL,
	PRIMARY KEY(`url`, `user_email`, `shelf_name`, `media_id`),
	FOREIGN KEY (`url`,`media_id`) REFERENCES `media`(`url`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shelved_media_shelf_name_index` ON `shelved_media` (`url`,`user_email`,`shelf_name`);--> statement-breakpoint
CREATE INDEX `shelved_media_synced_index` ON `shelved_media` (`url`,`user_email`,`synced`);