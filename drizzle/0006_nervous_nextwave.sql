CREATE INDEX `person_index` ON `authors` (`url`,`person_id`);--> statement-breakpoint
CREATE INDEX `author_index` ON `book_authors` (`url`,`author_id`);--> statement-breakpoint
CREATE INDEX `book_index` ON `book_authors` (`url`,`book_id`);--> statement-breakpoint
CREATE INDEX `published_index` ON `books` (`published`);--> statement-breakpoint
CREATE INDEX `media_index` ON `local_player_states` (`url`,`media_id`);--> statement-breakpoint
CREATE INDEX `book_index` ON `media` (`url`,`book_id`);--> statement-breakpoint
CREATE INDEX `status_index` ON `media` (`status`);--> statement-breakpoint
CREATE INDEX `inserted_at_index` ON `media` (`inserted_at`);--> statement-breakpoint
CREATE INDEX `published_index` ON `media` (`published`);--> statement-breakpoint
CREATE INDEX `media_index` ON `media_narrators` (`url`,`media_id`);--> statement-breakpoint
CREATE INDEX `narrator_index` ON `media_narrators` (`url`,`narrator_id`);--> statement-breakpoint
CREATE INDEX `person_index` ON `narrators` (`url`,`person_id`);--> statement-breakpoint
CREATE INDEX `email_index` ON `player_states` (`user_email`);--> statement-breakpoint
CREATE INDEX `status_index` ON `player_states` (`status`);--> statement-breakpoint
CREATE INDEX `media_index` ON `player_states` (`url`,`media_id`);--> statement-breakpoint
CREATE INDEX `updated_at_index` ON `player_states` (`updated_at`);--> statement-breakpoint
CREATE INDEX `book_index` ON `series_books` (`url`,`book_id`);--> statement-breakpoint
CREATE INDEX `series_index` ON `series_books` (`url`,`series_id`);