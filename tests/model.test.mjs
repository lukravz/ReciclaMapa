import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,activePoints,totalKg,regions,optimizeRoute,routeDistance,completeCollection,addPoint,demoWorkspace,forecast,forecast7Days} from '../lib/model.ts';

test('seed quantities and real validation are separated',()=>{
 const state=initialState();
 assert.equal(totalKg(activePoints(state.simulated)),157);
 assert.equal(regions(state.simulated.points)[0].kg,102);
 assert.equal(state.registered.points.length,0);
 assert.equal(state.validation.collectors+state.validation.cooperatives+state.validation.businesses+state.validation.residents,0);
});
test('create, plan and collect conserve material and avoid duplicate collections',()=>{
 let w=initialState().registered;
 const p={...initialState().simulated.points[0],id:'registered',source:'registered',kg:20};
 w=addPoint(w,p);
 assert.equal(totalKg(activePoints(w)),20);
 w=completeCollection(w,['registered'],'2026-09-19T12:00:00Z');
 assert.equal(activePoints(w).length,0);
 assert.equal(w.collections[0].kg,20);
 assert.equal(totalKg(w.points),20);
 assert.equal(w.collections[0].points[0].source,'registered');
 assert.strictEqual(completeCollection(w,['registered']),w);
 const restored=JSON.parse(JSON.stringify(w));
 assert.equal(restored.collections[0].kg,20);
 assert.equal(restored.points[0].status,'collected');
});
test('route keeps start and every point, never suggests a longer path',()=>{
 const seed=initialState().simulated.points;
 const points=[seed[0],seed[5],seed[1],seed[4],seed[2],seed[3]];
 const result=optimizeRoute(points);
 assert.equal(result[0].id,points[0].id);
 assert.deepEqual(result.map(p=>p.id).sort(),points.map(p=>p.id).sort());
 assert.ok(routeDistance(result)<=routeDistance(points));
 assert.ok(routeDistance(result)<routeDistance(points));
 assert.equal(routeDistance([]),0);
 assert.deepEqual(optimizeRoute([]),[]);
});
test('invalid quantities and coordinates are rejected',()=>{
 const s=initialState();const p=s.simulated.points[0];
 for(const patch of [{kg:0},{kg:-2},{kg:NaN},{lat:91},{lng:181},{name:' '}])assert.throws(()=>addPoint(s.registered,{...p,...patch}));
});
test('demo reconciles 124 kg in Centro and 98 kg in 4 stops',()=>{
 const w=demoWorkspace();
 assert.equal(regions(w.points).find(r=>r.name==='Centro').kg,124);
 const done=completeCollection(w,['sample-0','sample-1','sample-2','sample-3']);
 assert.equal(done.collections[0].kg,98);
 assert.equal(done.collections[0].points.length,4);
 assert.equal(totalKg(activePoints(done)),81);
});
test('forecast derives from real history and excludes already available stock',()=>{
 const p={...initialState().simulated.points[0],kg:48,source:'registered'};
 let w={points:[p],collections:[],plan:null};
 assert.equal(forecast(w,p),null);
 for(const [i,kg] of [48,53,51].entries()){
   if(i)w=addPoint(w,{...p,id:`week-${i}`,kg});
   w=completeCollection(w,[i?`week-${i}`:p.id],`2026-09-${String(1+i*7).padStart(2,'0')}T12:00:00Z`);
 }
 const estimate=forecast(w,p,new Date('2026-09-16T12:00:00Z'));
 assert.ok(Math.abs(estimate.average-51.1666667)<.0001);
 assert.equal(estimate.samples,3);
 assert.equal(estimate.next.toISOString(),'2026-09-22T12:00:00.000Z');
 assert.ok(forecast7Days(w,new Date('2026-09-16T12:00:00Z'))>50);
 w=addPoint(w,{...p,id:'next-batch',kg:54});
 assert.equal(forecast7Days(w,new Date('2026-09-16T12:00:00Z')),0);
});
