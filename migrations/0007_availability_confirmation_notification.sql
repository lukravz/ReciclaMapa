-- Confirmation events remain in the operational history regardless of bell preferences.
CREATE TRIGGER availability_confirmation_notification AFTER UPDATE OF confirmed_at ON waste_points
WHEN NEW.confirmed_at IS NOT NULL AND NEW.confirmed_at IS NOT OLD.confirmed_at AND NEW.status IN ('available','reserved','scheduled')
BEGIN
 INSERT INTO notifications(id,user_id,type,title,message,entity_type,entity_id,created_at)
 SELECT lower(hex(randomblob(16))),recipient,'availability.confirmed','Disponibilidade confirmada.','A disponibilidade do material foi confirmada. Consulte a validade e os horários no anúncio.','waste',NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now')
 FROM (SELECT NEW.generator_user_id AS recipient UNION SELECT owner_user_id FROM cooperatives WHERE id=NEW.reserved_by);
END;
