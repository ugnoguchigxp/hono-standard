CREATE TABLE `page_duplicate_requests` (
	`owner_id` text NOT NULL,
	`request_id` text NOT NULL,
	`source_page_id` text NOT NULL,
	`input_json` text NOT NULL,
	`created_page_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `page_duplicate_requests_owner_request_idx` ON `page_duplicate_requests` (`owner_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `page_duplicate_requests_created_page_idx` ON `page_duplicate_requests` (`created_page_id`);