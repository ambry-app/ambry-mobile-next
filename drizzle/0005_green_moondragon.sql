PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_media` (
	`url` text NOT NULL,
	`id` text NOT NULL,
	`status` text,
	`book_id` text NOT NULL,
	`chapters` text NOT NULL,
	`supplemental_files` text NOT NULL,
	`full_cast` integer NOT NULL,
	`abridged` integer NOT NULL,
	`mpd_path` text,
	`hls_path` text,
	`mp4_path` text,
	`duration` text,
	`published` integer,
	`published_format` text NOT NULL,
	`notes` text,
	`thumbnails` text,
	`description` text,
	`publisher` text,
	`inserted_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`url`, `id`),
	FOREIGN KEY (`url`,`book_id`) REFERENCES `books`(`url`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_media`("url", "id", "status", "book_id", "chapters", "supplemental_files", "full_cast", "abridged", "mpd_path", "hls_path", "mp4_path", "duration", "published", "published_format", "notes", "thumbnails", "description", "publisher", "inserted_at", "updated_at") SELECT "url", "id", "status", "book_id", "chapters", '[]', "full_cast", "abridged", "mpd_path", "hls_path", "mp4_path", "duration", "published", "published_format", NULL, "thumbnails", "description", NULL, "inserted_at", "updated_at" FROM `media`;--> statement-breakpoint
DROP TABLE `media`;--> statement-breakpoint
ALTER TABLE `__new_media` RENAME TO `media`;--> statement-breakpoint
PRAGMA foreign_keys=ON;