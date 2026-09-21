CREATE TABLE `brain_checkpoints` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`sim_time_ms` integer NOT NULL,
	`snapshot` text NOT NULL,
	`metrics` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `brain_experiments`(`run_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brain_checkpoints_run_time_idx` ON `brain_checkpoints` (`run_id`,`sim_time_ms`);--> statement-breakpoint
CREATE TABLE `brain_commands` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_user_id` text NOT NULL,
	`command_id` text NOT NULL,
	`run_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`response` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `brain_experiments`(`run_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brain_commands_owner_command_idx` ON `brain_commands` (`owner_user_id`,`command_id`);--> statement-breakpoint
CREATE TABLE `brain_experiments` (
	`run_id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`status` text NOT NULL,
	`terminal_reason` text,
	`seed` integer NOT NULL,
	`engine_version` integer NOT NULL,
	`config_version` integer NOT NULL,
	`resolved_config` text NOT NULL,
	`initial_topology` text NOT NULL,
	`final_snapshot` text,
	`summary_metrics` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `brain_experiments_owner_idx` ON `brain_experiments` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `brain_experiments_status_idx` ON `brain_experiments` (`status`);