CREATE TABLE `author_people` (
	`url` text NOT NULL,
	`id` text NOT NULL,
	`author_id` text NOT NULL,
	`person_id` text NOT NULL,
	`inserted_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`url`, `id`),
	FOREIGN KEY (`url`,`author_id`) REFERENCES `authors`(`url`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`url`,`person_id`) REFERENCES `people`(`url`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `author_people_author_index` ON `author_people` (`url`,`author_id`);--> statement-breakpoint
CREATE INDEX `author_people_person_index` ON `author_people` (`url`,`person_id`);--> statement-breakpoint
CREATE TABLE `book_universes` (
	`url` text NOT NULL,
	`id` text NOT NULL,
	`book_id` text NOT NULL,
	`universe_id` text NOT NULL,
	`inserted_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`url`, `id`),
	FOREIGN KEY (`url`,`book_id`) REFERENCES `books`(`url`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`url`,`universe_id`) REFERENCES `universes`(`url`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_universes_book_index` ON `book_universes` (`url`,`book_id`);--> statement-breakpoint
CREATE INDEX `book_universes_universe_index` ON `book_universes` (`url`,`universe_id`);--> statement-breakpoint
CREATE TABLE `media_tracks` (
	`url` text NOT NULL,
	`id` text NOT NULL,
	`media_id` text NOT NULL,
	`index` integer NOT NULL,
	`path` text NOT NULL,
	`size` real NOT NULL,
	`mime` text,
	`format` text,
	`codec` text,
	`duration` real NOT NULL,
	`start_offset` real NOT NULL,
	`seek_accuracy` text NOT NULL,
	`inserted_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`url`, `id`),
	FOREIGN KEY (`url`,`media_id`) REFERENCES `media`(`url`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `media_tracks_media_index` ON `media_tracks` (`url`,`media_id`,`index`);--> statement-breakpoint
CREATE TABLE `recording_groups` (
	`url` text NOT NULL,
	`id` text NOT NULL,
	`book_id` text NOT NULL,
	`parts_total` integer,
	`part_word` text,
	`part_word_plural` text,
	`inserted_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`url`, `id`),
	FOREIGN KEY (`url`,`book_id`) REFERENCES `books`(`url`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recording_groups_book_index` ON `recording_groups` (`url`,`book_id`);--> statement-breakpoint
CREATE TABLE `universes` (
	`url` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`inserted_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`url`, `id`)
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_authors` (
	`url` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`inserted_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`url`, `id`)
);
--> statement-breakpoint
INSERT INTO `__new_authors`("url", "id", "name", "inserted_at", "updated_at") SELECT "url", "id", "name", "inserted_at", "updated_at" FROM `authors`;--> statement-breakpoint
DROP TABLE `authors`;--> statement-breakpoint
ALTER TABLE `__new_authors` RENAME TO `authors`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `book_authors` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE `__new_media` (
	`url` text NOT NULL,
	`id` text NOT NULL,
	`status` text,
	`book_id` text NOT NULL,
	`title` text,
	`recording_group_id` text,
	`part_number` integer,
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
	FOREIGN KEY (`url`,`book_id`) REFERENCES `books`(`url`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`url`,`recording_group_id`) REFERENCES `recording_groups`(`url`,`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_media`("url", "id", "status", "book_id", "title", "recording_group_id", "part_number", "chapters", "supplemental_files", "full_cast", "abridged", "mpd_path", "hls_path", "mp4_path", "duration", "published", "published_format", "notes", "thumbnails", "description", "publisher", "inserted_at", "updated_at") SELECT "url", "id", "status", "book_id", NULL, NULL, NULL, "chapters", "supplemental_files", "full_cast", "abridged", "mpd_path", "hls_path", "mp4_path", "duration", "published", "published_format", "notes", "thumbnails", "description", "publisher", "inserted_at", "updated_at" FROM `media`;--> statement-breakpoint
DROP TABLE `media`;--> statement-breakpoint
ALTER TABLE `__new_media` RENAME TO `media`;--> statement-breakpoint
CREATE INDEX `media_book_index` ON `media` (`url`,`book_id`);--> statement-breakpoint
CREATE INDEX `media_recording_group_index` ON `media` (`url`,`recording_group_id`);--> statement-breakpoint
CREATE INDEX `media_status_index` ON `media` (`status`);--> statement-breakpoint
CREATE INDEX `media_inserted_at_index` ON `media` (`inserted_at`);--> statement-breakpoint
CREATE INDEX `media_published_index` ON `media` (`published`);--> statement-breakpoint
CREATE INDEX `media_url_status_inserted_at_idx` ON `media` (`url`,`status`,`inserted_at`);--> statement-breakpoint
ALTER TABLE `media_narrators` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `series_books` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Library sync is a cursor, not a per-row synced flag: the server only returns
-- rows whose updated_at is newer than last_sync_time. Rows already on the
-- device were written before these columns existed and the server has no
-- reason to touch them again, so clearing the cursor is what makes the next
-- sync re-fetch the whole library and fill them in. Deletions are not missed:
-- everything deleted before now was already applied, and the cursor this sync
-- writes covers everything after.
UPDATE `synced_servers` SET `last_sync_time` = NULL;