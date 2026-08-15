ALTER TABLE `recording_groups` ADD `name` text;--> statement-breakpoint
ALTER TABLE `recording_groups` ADD `show_label` integer DEFAULT false NOT NULL;
