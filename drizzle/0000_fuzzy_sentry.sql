CREATE TABLE `authors` (
	`url` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`person_id` integer NOT NULL,
	`inserted_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`url`, `id`),
	FOREIGN KEY (`url`,`person_id`) REFERENCES `people`(`url`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `book_authors` (
	`url` text NOT NULL,
	`id` text NOT NULL,
	`author_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	PRIMARY KEY(`url`, `id`),
	FOREIGN KEY (`url`,`author_id`) REFERENCES `authors`(`url`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`url`,`book_id`) REFERENCES `books`(`url`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `books` (
	`url` text NOT NULL,
	`id` text NOT NULL,
	`title` text NOT NULL,
	`published` integer NOT NULL,
	`published_format` text NOT NULL,
	`inserted_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`url`, `id`)
);
--> statement-breakpoint
CREATE TABLE `media` (
	`url` text NOT NULL,
	`id` text NOT NULL,
	`book_id` integer NOT NULL,
	`chapters` text NOT NULL,
	`full_cast` integer NOT NULL,
	`abridged` integer NOT NULL,
	`mpd_path` text,
	`hls_path` text,
	`mp4_path` text,
	`duration` text,
	`published` integer,
	`published_format` text,
	`image_path` text,
	`description` text,
	`inserted_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`url`, `id`),
	FOREIGN KEY (`url`,`book_id`) REFERENCES `books`(`url`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `media_narrators` (
	`url` text NOT NULL,
	`id` text NOT NULL,
	`media_id` integer NOT NULL,
	`narrator_id` integer NOT NULL,
	PRIMARY KEY(`url`, `id`),
	FOREIGN KEY (`url`,`media_id`) REFERENCES `media`(`url`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`url`,`narrator_id`) REFERENCES `narrators`(`url`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `narrators` (
	`url` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`person_id` integer NOT NULL,
	`inserted_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`url`, `id`),
	FOREIGN KEY (`url`,`person_id`) REFERENCES `people`(`url`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `people` (
	`url` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`image_path` text,
	`inserted_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`url`, `id`)
);
--> statement-breakpoint
CREATE TABLE `series` (
	`url` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`inserted_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`url`, `id`)
);
--> statement-breakpoint
CREATE TABLE `series_books` (
	`url` text NOT NULL,
	`id` text NOT NULL,
	`book_id` integer NOT NULL,
	`series_id` integer NOT NULL,
	`book_number` text NOT NULL,
	PRIMARY KEY(`url`, `id`),
	FOREIGN KEY (`url`,`book_id`) REFERENCES `books`(`url`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`url`,`series_id`) REFERENCES `series`(`url`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `servers` (
	`url` text PRIMARY KEY NOT NULL,
	`last_sync` integer
);
