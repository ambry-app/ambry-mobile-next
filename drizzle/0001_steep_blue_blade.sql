ALTER TABLE `media` ADD `thumbnails` text;--> statement-breakpoint
ALTER TABLE `people` ADD `thumbnails` text;--> statement-breakpoint
ALTER TABLE `media` DROP COLUMN `image_path`;--> statement-breakpoint
ALTER TABLE `people` DROP COLUMN `image_path`;