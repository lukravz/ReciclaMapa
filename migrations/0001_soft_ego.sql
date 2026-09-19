CREATE TABLE `provider_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `provider_locks` (
	`provider` text PRIMARY KEY NOT NULL,
	`next_allowed` integer NOT NULL
);
