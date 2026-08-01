CREATE TABLE `local_settings` (
	`id` text PRIMARY KEY DEFAULT 'local' NOT NULL,
	`preferred_playback_rate` real DEFAULT 1 NOT NULL,
	`sleep_timer` integer DEFAULT 600 NOT NULL,
	`sleep_timer_enabled` integer DEFAULT false NOT NULL,
	`sleep_timer_motion_detection_enabled` integer DEFAULT false NOT NULL,
	`sleep_timer_trigger_time` integer
);
--> statement-breakpoint
INSERT INTO `local_settings` (`id`, `preferred_playback_rate`, `sleep_timer`, `sleep_timer_enabled`, `sleep_timer_motion_detection_enabled`, `sleep_timer_trigger_time`)
SELECT 'local', s.`preferred_playback_rate`, s.`sleep_timer`, s.`sleep_timer_enabled`, s.`sleep_timer_motion_detection_enabled`, s.`sleep_timer_trigger_time`
FROM `local_user_settings` s
ORDER BY (
	SELECT max(p.`last_sync_time`)
	FROM `server_profiles` p
	WHERE p.`user_email` = s.`user_email`
) DESC, s.`rowid` DESC
LIMIT 1;
--> statement-breakpoint
DROP TABLE `local_user_settings`;