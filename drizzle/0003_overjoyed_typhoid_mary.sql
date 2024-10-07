CREATE TABLE `downloads` (
	`url` text NOT NULL,
	`media_id` text NOT NULL,
	`downloaded_at` integer NOT NULL,
	`file_path` text NOT NULL,
	`download_resumable_snapshot` text,
	`status` text NOT NULL,
	PRIMARY KEY(`url`, `media_id`),
	FOREIGN KEY (`url`,`media_id`) REFERENCES `media`(`url`,`id`) ON UPDATE no action ON DELETE cascade
);
