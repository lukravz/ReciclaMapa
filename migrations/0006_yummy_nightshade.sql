CREATE TABLE `account_plans` (
	`user_id` text PRIMARY KEY NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`legacy_access` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "account_plan_valid" CHECK("account_plans"."plan" IN ('free','pro','institutional'))
);
--> statement-breakpoint
CREATE TABLE `account_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`reduce_motion` integer DEFAULT false NOT NULL,
	`notifications_json` text DEFAULT '{"scheduling":true,"changes":true,"confirmation":true,"results":true}' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "theme_valid" CHECK("account_preferences"."theme" IN ('light','dark','system'))
);
--> statement-breakpoint
CREATE TABLE `organization_plans` (
	`cooperative_id` text PRIMARY KEY NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`legacy_access` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`cooperative_id`) REFERENCES `cooperatives`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "organization_plan_valid" CHECK("organization_plans"."plan" IN ('free','pro','institutional'))
);
--> statement-breakpoint
-- Preserve existing access explicitly; new accounts start on the free plan.
INSERT INTO account_plans(user_id,plan,legacy_access) SELECT id,'free',1 FROM users;
--> statement-breakpoint
INSERT INTO organization_plans(cooperative_id,plan,legacy_access) SELECT id,'free',1 FROM cooperatives;
--> statement-breakpoint
CREATE TRIGGER new_account_plan AFTER INSERT ON users BEGIN
 INSERT INTO account_plans(user_id,plan,legacy_access) VALUES(NEW.id,'free',0);
END;
--> statement-breakpoint
CREATE TRIGGER new_organization_plan AFTER INSERT ON cooperatives BEGIN
 INSERT INTO organization_plans(cooperative_id,plan,legacy_access)
 SELECT NEW.id,COALESCE((SELECT plan FROM account_plans WHERE user_id=NEW.owner_user_id),'free'),COALESCE((SELECT legacy_access FROM account_plans WHERE user_id=NEW.owner_user_id),0);
END;
