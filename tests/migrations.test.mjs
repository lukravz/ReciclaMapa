import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8');
test('incremental migration preserves data and emits transactional notifications once',()=>{
 const db=new DatabaseSync(':memory:');db.exec(read('0000_mushy_marvel_apes.sql'));db.exec(read('0001_soft_ego.sql'));
 db.exec("INSERT INTO users VALUES ('g','Generator','g@test.invalid','hash','generator','now','now'),('c','Coop','c@test.invalid','hash','cooperative','now','now'); INSERT INTO cooperatives VALUES ('coop','c','Base','','Base',-3.7,-38.5,'City','CE',20,300,1,'now','now');");
 db.exec("INSERT INTO waste_points (id,generator_user_id,generator_name,generator_type,material_type,quantity_kg,latitude,longitude,address_private,address_public,neighborhood,city,state,availability,availability_date,recurrence_type,created_at,updated_at) VALUES ('p','g','Generator','Residência','Papelão',42,-3.7,-38.5,'private','public','Centro','City','CE','Hoje','2026-09-19','Semanal','now','now');");
 db.exec(read('0002_logistics.sql'));db.exec(read('0003_notification_events.sql'));
 assert.equal(db.prepare('SELECT minimum_collection_kg n FROM cooperatives').get().n,0);assert.equal(db.prepare('SELECT count(*) n FROM waste_points').get().n,1);
 db.exec("UPDATE waste_points SET status='reserved',reserved_by='coop' WHERE id='p'");assert.equal(db.prepare('SELECT count(*) n FROM notifications').get().n,2);
 db.exec("UPDATE waste_points SET status='reserved' WHERE id='p'");assert.equal(db.prepare('SELECT count(*) n FROM notifications').get().n,2);
 db.exec("BEGIN; UPDATE waste_points SET status='available' WHERE id='p'; ROLLBACK;");assert.equal(db.prepare('SELECT count(*) n FROM notifications').get().n,2);
 db.exec("UPDATE waste_points SET status='scheduled',scheduled_date='2026-09-20',time_window='14–16' WHERE id='p'; INSERT INTO routes (id,cooperative_id,status,total_weight_kg,created_at) VALUES ('r','coop','scheduled',42,'now'); INSERT INTO route_points VALUES ('rp','r','p',1,-3.7,-38.5); UPDATE routes SET status='in_progress' WHERE id='r'; UPDATE waste_points SET status='collected' WHERE id='p';");
 assert.equal(db.prepare("SELECT count(*) n FROM notifications WHERE user_id='g'").get().n,4);assert.ok(db.prepare("SELECT message FROM notifications WHERE type='waste.scheduled'").get().message.includes('14–16'));
 db.exec("UPDATE waste_points SET status='available',reserved_by=NULL WHERE id='p'; UPDATE waste_points SET status='cancelled' WHERE id='p';");assert.ok(db.prepare("SELECT title FROM notifications WHERE type='waste.available'").get().title.includes('cancelada'));
 assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE name IN ('waste_images','waste_ai_classifications')").get().n,0);db.close();
});
