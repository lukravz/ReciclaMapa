-- Events share the transaction of the status update. A failed precondition rolls back notices too.
CREATE TRIGGER waste_notification_event AFTER UPDATE OF status, scheduled_date, time_window ON waste_points
WHEN OLD.status <> NEW.status OR (NEW.status='scheduled' AND (OLD.scheduled_date IS NOT NEW.scheduled_date OR OLD.time_window IS NOT NEW.time_window))
BEGIN
 INSERT INTO notifications (id,user_id,type,title,message,entity_type,entity_id,created_at)
 SELECT lower(hex(randomblob(16))), recipient, 'waste.'||NEW.status,
 CASE NEW.status WHEN 'reserved' THEN 'Seu material foi reservado.' WHEN 'scheduled' THEN 'Coleta agendada.' WHEN 'collected' THEN 'Coleta concluída.' WHEN 'cancelled' THEN 'Resíduo cancelado.' ELSE 'Reserva cancelada.' END,
 CASE NEW.status WHEN 'scheduled' THEN 'Coleta agendada para '||NEW.scheduled_date||' · '||NEW.time_window WHEN 'available' THEN 'O material voltou a ficar disponível.' WHEN 'collected' THEN 'O peso informado está no histórico de coleta.' ELSE 'Consulte o acompanhamento do material.' END,
 'waste',NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now')
 FROM (SELECT NEW.generator_user_id AS recipient UNION SELECT owner_user_id FROM cooperatives WHERE id=COALESCE(NEW.reserved_by,OLD.reserved_by));
END;
--> statement-breakpoint
CREATE TRIGGER route_started_notification AFTER UPDATE OF status ON routes
WHEN NEW.status='in_progress' AND OLD.status<>'in_progress'
BEGIN
 INSERT INTO notifications (id,user_id,type,title,message,entity_type,entity_id,created_at)
 SELECT lower(hex(randomblob(16))),recipient,'route.started','A rota de coleta foi iniciada.','Acompanhe o status em Meus resíduos ou Rotas.','route',NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now')
 FROM (SELECT w.generator_user_id AS recipient FROM route_points rp JOIN waste_points w ON w.id=rp.waste_point_id WHERE rp.route_id=NEW.id UNION SELECT owner_user_id FROM cooperatives WHERE id=NEW.cooperative_id);
END;
