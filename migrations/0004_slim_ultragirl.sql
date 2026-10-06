CREATE TABLE `stop_results` (
	`id` text PRIMARY KEY NOT NULL,
	`route_id` text,
	`collection_id` text,
	`waste_point_id` text NOT NULL,
	`cooperative_id` text NOT NULL,
	`recorded_by` text NOT NULL,
	`outcome` text NOT NULL,
	`estimated_weight` real NOT NULL,
	`actual_weight` real NOT NULL,
	`remaining_kg` real DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`waste_point_id`) REFERENCES `waste_points`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cooperative_id`) REFERENCES `cooperatives`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stop_result_weights" CHECK("stop_results"."actual_weight">=0 AND "stop_results"."remaining_kg">=0 AND (("stop_results"."outcome" IN ('collected','partial') AND "stop_results"."actual_weight">0) OR ("stop_results"."outcome" IN ('closed','unavailable','unsuitable','other') AND "stop_results"."actual_weight"=0 AND "stop_results"."remaining_kg"=0)) AND ("stop_results"."outcome"='partial' OR "stop_results"."remaining_kg"=0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stop_result_route_point_unique` ON `stop_results` (`route_id`,`waste_point_id`);--> statement-breakpoint
CREATE INDEX `stop_result_owner_idx` ON `stop_results` (`waste_point_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `routes` ADD `review_required` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `routes` ADD `revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `waste_points` ADD `pickup_windows_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `waste_points` ADD `access_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `waste_points` ADD `confirmed_at` text;--> statement-breakpoint
ALTER TABLE `waste_points` ADD `expires_at` text;--> statement-breakpoint
ALTER TABLE `waste_points` ADD `validity_days` integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE `waste_points` ADD `revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `waste_points` ADD `planning_review` integer DEFAULT false NOT NULL;
--> statement-breakpoint
-- Legacy announcements remain usable until their first explicit confirmation.
CREATE TRIGGER material_planning_review AFTER UPDATE ON waste_points
WHEN NEW.revision <> OLD.revision AND (NEW.quantity_kg<>OLD.quantity_kg OR NEW.material_type<>OLD.material_type OR NEW.latitude<>OLD.latitude OR NEW.longitude<>OLD.longitude OR NEW.address_private<>OLD.address_private OR NEW.pickup_windows_json<>OLD.pickup_windows_json OR NEW.access_note<>OLD.access_note OR NEW.expires_at IS NOT OLD.expires_at OR NEW.confirmed_at IS NOT OLD.confirmed_at OR (NEW.status='cancelled' AND OLD.status<>'cancelled'))
AND (NEW.reserved_by IS NOT NULL OR EXISTS(SELECT 1 FROM route_points rp JOIN routes r ON r.id=rp.route_id WHERE rp.waste_point_id=NEW.id AND r.status IN ('draft','scheduled','in_progress')))
BEGIN
 UPDATE waste_points SET planning_review=1 WHERE id=NEW.id;
 UPDATE routes SET review_required=1,comparison_json=CASE WHEN NEW.latitude<>OLD.latitude OR NEW.longitude<>OLD.longitude THEN NULL ELSE comparison_json END,original_distance_km=CASE WHEN NEW.latitude<>OLD.latitude OR NEW.longitude<>OLD.longitude THEN NULL ELSE original_distance_km END,optimized_distance_km=CASE WHEN NEW.latitude<>OLD.latitude OR NEW.longitude<>OLD.longitude THEN NULL ELSE optimized_distance_km END,revision=revision+1 WHERE id IN (SELECT rp.route_id FROM route_points rp WHERE rp.waste_point_id=NEW.id) AND status IN ('draft','scheduled','in_progress');
 INSERT INTO notifications (id,user_id,type,title,message,entity_type,entity_id,created_at)
 SELECT lower(hex(randomblob(16))),recipient,'material.changed','Material alterado: revise o planejamento.','O gerador alterou o anúncio. As demais paradas e reservas foram preservadas.','waste',NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now')
 FROM (SELECT owner_user_id AS recipient FROM cooperatives WHERE id=COALESCE(NEW.reserved_by,OLD.reserved_by) UNION SELECT c.owner_user_id FROM route_points rp JOIN routes r ON r.id=rp.route_id JOIN cooperatives c ON c.id=r.cooperative_id WHERE rp.waste_point_id=NEW.id AND r.status IN ('draft','scheduled','in_progress'));
END;
--> statement-breakpoint
CREATE TRIGGER stop_result_notification AFTER INSERT ON stop_results
BEGIN
 INSERT INTO notifications (id,user_id,type,title,message,entity_type,entity_id,created_at)
 SELECT lower(hex(randomblob(16))),w.generator_user_id,'collection.result','Resultado da sua coleta.','Consulte o resultado, o peso real e a observação em Meus resíduos.','waste',NEW.waste_point_id,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM waste_points w WHERE w.id=NEW.waste_point_id;
END;
