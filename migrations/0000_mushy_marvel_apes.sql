CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `collection_items` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`waste_point_id` text NOT NULL,
	`estimated_weight` real NOT NULL,
	`actual_weight` real,
	`collected_at` text NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`waste_point_id`) REFERENCES `waste_points`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "actual_weight_positive" CHECK("collection_items"."actual_weight" IS NULL OR "collection_items"."actual_weight">0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collection_items_waste_point_id_unique` ON `collection_items` (`waste_point_id`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`cooperative_id` text,
	`route_id` text,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`total_weight_kg` real,
	`total_distance_km` real,
	`legacy_owner_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`cooperative_id`) REFERENCES `cooperatives`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`legacy_owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collections_route_id_unique` ON `collections` (`route_id`);--> statement-breakpoint
CREATE TABLE `cooperative_materials` (
	`cooperative_id` text NOT NULL,
	`material_type` text NOT NULL,
	FOREIGN KEY (`cooperative_id`) REFERENCES `cooperatives`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cooperative_material_unique` ON `cooperative_materials` (`cooperative_id`,`material_type`);--> statement-breakpoint
CREATE TABLE `cooperatives` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`address` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`service_radius_km` real NOT NULL,
	`daily_capacity_kg` real NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "cooperative_positive" CHECK("cooperatives"."service_radius_km">0 AND "cooperatives"."daily_capacity_kg">0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cooperatives_owner_user_id_unique` ON `cooperatives` (`owner_user_id`);--> statement-breakpoint
CREATE TABLE `legacy_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`checksum` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `legacy_import_once` ON `legacy_imports` (`user_id`,`checksum`);--> statement-breakpoint
CREATE TABLE `operation_guards` (
	`id` text PRIMARY KEY NOT NULL,
	`ok` integer NOT NULL,
	CONSTRAINT "operation_precondition" CHECK("operation_guards"."ok"=1)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`phone` text,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`neighborhood` text NOT NULL,
	`profile_type` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_user_id_unique` ON `profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `route_points` (
	`id` text PRIMARY KEY NOT NULL,
	`route_id` text NOT NULL,
	`waste_point_id` text NOT NULL,
	`position` integer NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`waste_point_id`) REFERENCES `waste_points`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `route_point_unique` ON `route_points` (`route_id`,`waste_point_id`);--> statement-breakpoint
CREATE TABLE `routes` (
	`id` text PRIMARY KEY NOT NULL,
	`cooperative_id` text NOT NULL,
	`status` text NOT NULL,
	`original_distance_km` real,
	`optimized_distance_km` real,
	`total_weight_kg` real NOT NULL,
	`comparison_json` text,
	`scheduled_date` text,
	`time_window` text,
	`note` text,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`cooperative_id`) REFERENCES `cooperatives`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `routes_coop_idx` ON `routes` (`cooperative_id`,`status`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `validation_interviews` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by` text NOT NULL,
	`interviewee_type` text NOT NULL,
	`city` text NOT NULL,
	`main_problem` text NOT NULL,
	`current_solution` text NOT NULL,
	`difficulty` text NOT NULL,
	`would_use` text NOT NULL,
	`notes` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `waste_points` (
	`id` text PRIMARY KEY NOT NULL,
	`generator_user_id` text NOT NULL,
	`generator_name` text NOT NULL,
	`generator_type` text NOT NULL,
	`material_type` text NOT NULL,
	`quantity_kg` real NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`address_private` text NOT NULL,
	`address_public` text NOT NULL,
	`street` text DEFAULT '' NOT NULL,
	`number` text DEFAULT '' NOT NULL,
	`postcode` text DEFAULT '' NOT NULL,
	`neighborhood` text NOT NULL,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`availability` text NOT NULL,
	`availability_date` text NOT NULL,
	`recurrence_type` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`reserved_by` text,
	`scheduled_date` text,
	`time_window` text,
	`schedule_note` text,
	`location_confirmed` integer DEFAULT true NOT NULL,
	`legacy_key` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`generator_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reserved_by`) REFERENCES `cooperatives`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "waste_quantity_positive" CHECK("waste_points"."quantity_kg">0),
	CONSTRAINT "waste_coordinates_valid" CHECK("waste_points"."latitude" BETWEEN -90 AND 90 AND "waste_points"."longitude" BETWEEN -180 AND 180)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `waste_points_legacy_key_unique` ON `waste_points` (`legacy_key`);--> statement-breakpoint
CREATE INDEX `waste_search_idx` ON `waste_points` (`status`,`material_type`,`city`);--> statement-breakpoint
CREATE INDEX `waste_owner_idx` ON `waste_points` (`generator_user_id`);--> statement-breakpoint
CREATE INDEX `waste_reserved_idx` ON `waste_points` (`reserved_by`);