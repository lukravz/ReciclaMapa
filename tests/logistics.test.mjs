import test from 'node:test';
import assert from 'node:assert/strict';
import {onboardingRole} from '../lib/onboarding.ts';
import {lookupCep,normalizeCep} from '../lib/cep.ts';
import {summarizeHistory} from '../lib/history.ts';
import {opportunities,sortOpportunities,kgPerKm} from '../lib/logistics.ts';
import {demoWorkspace,initialState} from '../lib/model.ts';
import {demoAtStage,DEMO_IDS} from '../lib/demo-flow.ts';
import {operationalStep} from '../lib/status.ts';
test('onboarding maps both paths to existing public roles, never admin',()=>{
 assert.equal(onboardingRole('generator'),'generator');assert.equal(onboardingRole('collect','collector'),'collector');assert.equal(onboardingRole('collect','cooperative'),'cooperative');assert.equal(onboardingRole('collect'),null);assert.equal(onboardingRole('collect','admin'),null);
});
test('ViaCEP validates normalized input and maps address without coordinates',async()=>{
 assert.equal(normalizeCep('62380-000'),'62380000');for(const c of ['123','1234567a','123456789','12345--678'])assert.equal(normalizeCep(c),null);
 let count=0;const fetcher=async url=>{count++;assert.equal(url,'https://viacep.com.br/ws/62380000/json/');return Response.json({logradouro:'Rua',bairro:'Centro',localidade:'Cidade',uf:'CE'});};
 await assert.rejects(()=>lookupCep('bad',fetcher));assert.equal(count,0);assert.deepEqual(await lookupCep('62380000',fetcher),{cep:'62380000',logradouro:'Rua',bairro:'Centro',cidade:'Cidade',estado:'CE'});
 assert.equal(await lookupCep('62380000',async()=>Response.json({erro:true})),null);
 await assert.rejects(()=>lookupCep('62380000',async()=>new Response('',{status:503})));
 await assert.rejects(()=>lookupCep('62380000',async()=>{throw new Error('offline');}));
});
test('history: 1 no forecast, 2 range, 3+ weighted last-five window',()=>{
 const records=[10,20,30,40,50,60].map((kg,i)=>({kg,date:`2026-09-${String(i+1).padStart(2,'0')}T12:00:00Z`}));
 assert.equal(summarizeHistory(records.slice(0,1),'Semanal').weighted,null);const two=summarizeHistory(records.slice(0,2),'Semanal');assert.equal(two.weighted,null);assert.equal(two.min,10);assert.equal(two.max,20);
 assert.equal(summarizeHistory(records.slice(0,3),'Semanal').weighted,140/6);assert.equal(summarizeHistory(records,'Semanal').weighted,700/15);assert.equal(summarizeHistory(records,'Única').next,null);
});
test('concentration and opportunities count only eligible available points and respect capacity',()=>{
 const w=demoWorkspace(),c={...w.cooperative,capacityKg:60,minimumCollectionKg:100,acceptedMaterials:['Papelão']};
 const groups=opportunities(w.points,c);const centro=groups.find(g=>g.region==='Centro');assert.equal(centro.totalKg,124);assert.ok(centro.reservableKg<=60);assert.ok(centro.belowMinimum);assert.ok(centro.ids.every(id=>w.points.find(p=>p.id===id).material==='Papelão'));assert.equal(centro.forecastKg,null);
 const filtered=opportunities(w.points.map(p=>({...p,status:'reserved'})),c);assert.equal(filtered.length,0);
 assert.equal(sortOpportunities(groups,'quantity')[0].totalKg,Math.max(...groups.map(g=>g.totalKg)));
 assert.equal(kgPerKm(100,5),20);assert.equal(kgPerKm(100,0),null);assert.equal(kgPerKm(100,null),null);
 assert.notEqual(centro.kgPerKm,kgPerKm(centro.reservableKg,20));
});
test('residential opportunity distances do not depend on precise home coordinates',()=>{
 const w=demoWorkspace(),home=w.points.find(p=>p.type==='Residência'),changed={...home,lat:home.lat+.0001,lng:home.lng+.0001};assert.equal(opportunities([home],w.cooperative)[0].distanceKm,opportunities([changed],w.cooperative)[0].distanceKm);
});
test('territories distinguish cities and stock is never synthesized from forecasts',()=>{
 const w=demoWorkspace(),p=w.points[0];assert.equal(opportunities([p,{...p,id:'other',city:'Outra cidade'}],w.cooperative).length,2);
 const history={...summarizeHistory([{date:'2026-09-01',kg:10},{date:'2026-09-08',kg:20},{date:'2026-09-15',kg:30}],'Semanal',new Date('2026-09-16')),name:p.name,material:p.material,region:p.region,frequency:p.frequency,records:[],point:p};const g=opportunities([p],w.cooperative,[history],new Date('2026-09-16'))[0];assert.equal(g.forecastKg,0);assert.equal(g.totalKg,p.kg);
 const empty=opportunities([],w.cooperative,[history],new Date('2026-09-16'))[0];assert.equal(empty.recurringSources,1);assert.equal(empty.totalKg,0);assert.equal(empty.forecastKg,history.weighted);
});
test('demo lifecycle is isolated, requires a route and preserves status enums',()=>{
 const real=initialState().registered,before=JSON.stringify(real),road={distanceKm:10,durationMinutes:20,geometry:[],provider:'OSRM',calculatedAt:new Date().toISOString()},comparison={original:road,suggested:road,originalIds:DEMO_IDS,suggestedIds:DEMO_IDS,start:demoWorkspace().cooperative,fingerprint:'test',approximateResidential:false};
 assert.throws(()=>demoAtStage(6));assert.equal(demoAtStage(6,comparison).points[0].status,'reserved');assert.equal(demoAtStage(7,comparison).points[0].status,'scheduled');assert.equal(demoAtStage(8,comparison).points[0].inProgress,true);assert.equal(demoAtStage(10,comparison).collections[0].kg,98);assert.equal(JSON.stringify(real),before);assert.equal(demoAtStage(-1).collections.length,0);
 assert.equal(operationalStep('scheduled',true),3);assert.equal(operationalStep('collected'),4);assert.equal(operationalStep('cancelled'),-1);
});
