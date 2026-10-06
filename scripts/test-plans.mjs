// Test-only accounts and local D1. Never changes subscriptions in a remote database.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {getPlatformProxy} from 'wrangler';
const base=process.env.TEST_BASE_URL??'http://localhost:3001';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Only local testing is supported.');
const credentials=JSON.parse(await readFile('.wrangler/dev-credentials.json','utf8'));
async function req(actor,path,method='GET',data,status=200){
 const r=await fetch(base+'/api/'+path,{method,headers:{'Content-Type':'application/json',Origin:base,...(actor?{Cookie:actor.cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});
 const type=r.headers.get('content-type')??'',body=type.includes('json')?await r.json():await r.text();
 assert.equal(r.status,status,method+' '+path+': '+JSON.stringify(body));
 return {body,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
async function signIn(a,password=credentials.password){return req(null,'auth/login','POST',{email:a.email,password});}
const legacyCred=credentials.accounts.find(a=>a.role==='cooperative'),legacy=await signIn(legacyCred),gen=await signIn(credentials.accounts.find(a=>a.role==='generator'));
assert.equal((await req(legacy,'plans')).body.legacy,true);
assert.equal((await req(legacy,'plans')).body.features.parallelRoutes,true);
const suffix=Date.now(),password='QA-only-test-password-'+suffix,newPassword='QA-only-changed-password-'+suffix;
const email='plans-'+suffix+'@test.invalid',registration={name:'QA Plans '+suffix,email,password,role:'cooperative',city:'Fortaleza',state:'CE',neighborhood:'Centro'};
const actor=await req(null,'auth/register','POST',registration,201),userId=actor.body.user.id;
assert.equal((await req(actor,'plans')).body.plan,'free');
await req(actor,'plans','POST',{plan:'pro'},404);
const account=(await req(actor,'account')).body;
await req(actor,'account/profile','PATCH',{name:'Wrong',email:'hijack@test.invalid',phone:'',city:'Fortaleza',state:'CE',version:account.version},400);
await req(actor,'account/profile','PATCH',{name:'Wrong',role:'admin',phone:'',city:'Fortaleza',state:'CE',version:account.version},400);
const updated=(await req(actor,'account/profile','PATCH',{name:'QA Edited',phone:'0000000000',city:'Caucaia',state:'CE',version:account.version})).body;
assert.equal(updated.user.name,'QA Edited');assert.equal(updated.profile.phone,'0000000000');assert.equal(updated.user.email,email);
await req(actor,'account/profile','PATCH',{name:'Stale',phone:'',city:'Fortaleza',state:'CE',version:account.version},409);
const preferences={theme:'dark',reduceMotion:true,notifications:{scheduling:false,changes:false,confirmation:false,results:false},revision:0};
await req(actor,'account/preferences','PATCH',{...preferences,plan:'institutional'},400);
await req(actor,'account/preferences','PATCH',preferences);
await req(actor,'account/preferences','PATCH',preferences,409);
assert.equal((await req(actor,'account')).body.preferences.theme,'dark');
const coop={name:'QA plans base',address:'Fictitious public base',city:'Fortaleza',state:'CE',lat:-3.7463,lng:-38.5385,radiusKm:20,capacityKg:1000000,acceptedMaterials:['Papelão']};
const org=(await req(actor,'cooperatives','POST',coop)).body;
assert.equal((await req(actor,'plans')).body.organizationId,org.id);
await req(actor,'reports/export','GET',undefined,403);
await req(actor,'reports/productivity','GET',undefined,403);
assert.deepEqual((await req(actor,'intelligence')).body.groups,[]);
const template={name:'QA plans material '+suffix,type:'Residência',material:'Papelão',kg:10,address:'Private QA address',street:'Private QA address',number:'123',region:'Centro',city:'Fortaleza',state:'CE',lat:-3.73456,lng:-38.52387,availability:'Hoje',frequency:'Semanal',locationConfirmed:true};
const points=[];
for(let i=0;i<3;i++){const p=(await req(gen,'waste','POST',{...template,name:template.name+' '+i})).body;points.push(p);await req(actor,'waste/'+p.id+'/reserve','POST',{});}
const create=p=>({ids:[p.id],start:{lat:coop.lat,lng:coop.lng},calculate:false});
const race=await Promise.all(points.slice(0,2).map(p=>fetch(base+'/api/routes',{method:'POST',headers:{Cookie:actor.cookie,Origin:base,'Content-Type':'application/json'},body:JSON.stringify(create(p))})));
assert.equal(race.filter(r=>r.status===200).length,1);
assert.equal(race.filter(r=>[403,409].includes(r.status)).length,1);
const route=(await req(actor,'routes')).body[0];
await req(actor,'routes','POST',create(points[2]),403);
assert.equal((await req(actor,'routes')).body.length,1);
const proxy=await getPlatformProxy({remoteBindings:false});
try{
 // Upgrade only the freshly generated fictitious test organization, outside browser/API.
 await proxy.env.DB.prepare("UPDATE organization_plans SET plan='pro' WHERE cooperative_id=? AND cooperative_id IN (SELECT id FROM cooperatives WHERE owner_user_id=?)").bind(org.id,userId).run();
 await proxy.env.DB.prepare("INSERT INTO notifications(id,user_id,type,title,message,entity_type,entity_id,created_at) VALUES(?,?,'material.changed','QA critical','QA message','waste',?,?)").bind(crypto.randomUUID(),userId,points[0].id,new Date().toISOString()).run();
}finally{await proxy.dispose();}
assert.equal((await req(actor,'plans')).body.features.parallelRoutes,true);
const second=(await req(actor,'routes','POST',create(points[2]))).body;
await req(legacy,'routes/'+second.id+'/cancel','POST',{},403);
const notices=(await req(actor,'notifications')).body;assert.equal(notices.items.some(n=>n.type==='material.changed'),false);assert.equal(notices.allItems.some(n=>n.type==='material.changed'),true);
await req(actor,'reports/export?period=all');await req(gen,'reports/export','GET',undefined,403);
await req(actor,'routes/'+second.id+'/cancel','POST',{});
await req(actor,'routes/'+route.id+'/cancel','POST',{});
await req(actor,'waste/'+points[2].id+'/reserve','POST',{});
const date=new Date().toISOString().slice(0,10);
await req(actor,'waste/'+points[2].id+'/schedule','POST',{date,timeWindow:'08:00-10:00'});
const point=(await req(gen,'waste/'+points[2].id)).body;
await req(actor,'waste/'+point.id+'/result','POST',{outcome:'collected',actualWeight:6,date,revision:point.revision});
const report=(await req(actor,'reports/export')).body;assert.equal(report.split('\r\n').length,2);assert.ok(report.includes('"6"'));assert.equal(report.includes('Private QA address'),false);
assert.equal((await req(actor,'reports/productivity')).body.stops,1);
const secondSession=await signIn({email},password);
assert.equal((await req(secondSession,'account')).body.preferences.theme,'dark');
await req(actor,'account/password','POST',{currentPassword:'incorrect',newPassword},403);
await req(actor,'account/password','POST',{currentPassword:password,newPassword});
await req(actor,'account','GET',undefined,401);await req(secondSession,'account','GET',undefined,401);
await req(null,'auth/login','POST',{email,password},401);
const newSession=await signIn({email},newPassword);assert.equal((await req(newSession,'account')).body.preferences.reduceMotion,true);
await writeFile('.wrangler/plans-test-account.json',JSON.stringify({email,password:newPassword,userId,organizationId:org.id}));
console.log('PASS plans: legacy preservation, free route race limit, server-only entitlements, profile field protection, preference persistence/conflicts, organization isolation, notification history, password verification and session revocation.');
