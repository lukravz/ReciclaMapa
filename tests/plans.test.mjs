import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {accessFor,FEATURES} from '../lib/plans.ts';
import {defaultPreferences,notificationVisible} from '../lib/preferences.ts';
test('plans preserve essential features, legacy access and unimplemented boundaries',()=>{
 const free=accessFor(),legacy=accessFor('free',true),pro=accessFor('pro'),institutional=accessFor('institutional');
 for(const [key,f] of Object.entries(FEATURES)){if(f.plan==='free')assert.equal(free.features[key],true);if(!f.ready)assert.equal(institutional.features[key],false);}
 assert.equal(free.features.parallelRoutes,false);assert.equal(legacy.features.parallelRoutes,true);
 assert.equal(legacy.features.territory,true);assert.equal(legacy.features.exports,false);
 assert.equal(pro.features.exports,true);assert.equal(pro.features.team,false);
 assert.equal(accessFor('pro',false,'org').scope,'organization');
});
test('plan migration preserves old access and defaults new accounts/organizations to free',()=>{
 const db=new DatabaseSync(':memory:'),folder=new URL('../migrations/',import.meta.url),files=readdirSync(folder).filter(f=>f.endsWith('.sql')).sort();
 for(const file of files.filter(f=>f<'0006'))db.exec(readFileSync(new URL(file,folder),'utf8'));
 db.exec("INSERT INTO users VALUES('old','Old','old@test.invalid','hash','cooperative','now','now')");
 for(const file of files.filter(f=>f>='0006'))db.exec(readFileSync(new URL(file,folder),'utf8'));
 db.exec("INSERT INTO users VALUES('new','New','new@test.invalid','hash','cooperative','now','now')");
 const add=db.prepare("INSERT INTO cooperatives(id,owner_user_id,name,address,latitude,longitude,city,state,service_radius_km,daily_capacity_kg,created_at,updated_at) VALUES(?,?,'Base','Public',-3.7,-38.5,'City','CE',20,300,'now','now')");
 add.run('old-org','old');add.run('new-org','new');
 assert.equal(db.prepare("SELECT legacy_access FROM organization_plans WHERE cooperative_id='old-org'").get().legacy_access,1);
 assert.deepEqual({...db.prepare("SELECT plan,legacy_access FROM organization_plans WHERE cooperative_id='new-org'").get()},{plan:'free',legacy_access:0});
 assert.equal(db.prepare('SELECT count(*) n FROM users').get().n,2);
 assert.throws(()=>db.exec("UPDATE account_plans SET plan='invalid'"));
 db.close();
});
test('notification preferences filter supported categories without hiding unknown critical events',()=>{
 const prefs={...defaultPreferences,notifications:{scheduling:false,changes:false,confirmation:false,results:false}};
 for(const type of ['waste.reserved','waste.scheduled','material.changed','waste.cancelled','waste.available','collection.result','availability.confirmed'])assert.equal(notificationVisible(type,prefs),false,type);
 assert.equal(notificationVisible('security.unknown',prefs),true);
});
