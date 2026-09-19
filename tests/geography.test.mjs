import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateDistance,calculateRouteDistance,sortPointsByNearestNeighbor,visibleLocation,hasDefinedLocation,inRadius} from '../lib/geo.ts';
import {initialState,seedPoints,completeCollection} from '../lib/model.ts';
import {migrateState} from '../lib/storage.ts';
import {compareRoutes,routeFingerprint} from '../lib/routing.ts';
import {locateUser} from '../lib/geolocation.ts';

test('native location returns coordinates and denial offers a manual fallback (mocked browser)',async()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  try {
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{geolocation:{getCurrentPosition(success){success({coords:{latitude:-3.73,longitude:-38.52}});}}}});
    assert.deepEqual(await locateUser(),{lat:-3.73,lng:-38.52});
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{geolocation:{getCurrentPosition(_success,failure){failure({code:1});}}}});
    await assert.rejects(locateUser(),/Permissão de localização negada.*endereço ou clicar no mapa/);
  } finally {if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});

test('road service failure produces an error rather than invented distances',async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({error:'Serviço indisponível'},{status:503});
  try{await assert.rejects(compareRoutes(seedPoints(),{lat:-3.74,lng:-38.53}),/Serviço indisponível/);}
  finally{globalThis.fetch=previous;}
});

test('Haversine uses km, preserves endpoints and correctly filters radius',()=>{
  assert.ok(Math.abs(calculateDistance({lat:0,lng:0},{lat:0,lng:1})-111.195)<.01);
  assert.equal(calculateRouteDistance([]),0);
  const start={lat:0,lng:0},points=[{lat:0,lng:.03,id:'3'},{lat:0,lng:.01,id:'1'},{lat:0,lng:.02,id:'2'}];
  assert.deepEqual(sortPointsByNearestNeighbor(points,start,start).map(p=>p.id),['1','2','3']);
  assert.ok(inRadius({...seedPoints()[0],lat:0,lng:.01},start,5));
  assert.equal(inRadius({...seedPoints()[0],lat:0,lng:1},start,5),false);
});
test('residential markers use coarse coordinates and unknown old locations are not routable',()=>{
  const p={...seedPoints()[0],type:'Residência',lat:-3.734561,lng:-38.523876};
  assert.deepEqual(visibleLocation(p),{lat:-3.73,lng:-38.52});
  assert.equal(hasDefinedLocation({...p,coordinateKind:'schematic'}),false);
  assert.equal(hasDefinedLocation({...p,locationConfirmed:false}),false);
});
test('v1 migration preserves real records, weights, interview data and collection history',()=>{
  const old=initialState();old.version=1;old.registered.points=[{...seedPoints()[0],id:'old-home',source:'registered',coordinateKind:'schematic',locationConfirmed:undefined,kg:20}];
  old.validation.notes='Relato já existente';old.registered.collections=[{id:'old-collection',date:'2026-09-01T12:00:00Z',points:[{...old.registered.points[0],status:'collected'}],kg:20}];
  const migrated=migrateState(old);
  assert.equal(migrated.version,2);assert.equal(migrated.registered.points[0].kg,20);
  assert.equal(migrated.registered.points[0].locationConfirmed,false);
  assert.equal(migrated.registered.collections[0].kg,20);
  assert.equal(migrated.registered.collections[0].route,undefined);
  assert.equal(migrated.validation.notes,'Relato já existente');
  assert.equal(old.version,1);assert.equal(migrated.simulated.points[0].coordinateKind,'demonstrative');
  assert.strictEqual(migrateState(migrated),migrated);
});
test('road comparison keeps original when nearest-neighbor is worse on actual roads (mocked provider)',async()=>{
  const fetchBefore=globalThis.fetch,requests=[];
  globalThis.fetch=async(_url,options)=>{requests.push(JSON.parse(options.body));return Response.json({distanceKm:requests.length===1?10:12,durationMinutes:15,geometry:[[0,0],[.01,0]],provider:'OSRM',calculatedAt:'2026-09-19T00:00:00Z'});};
  try{
    const seed=seedPoints()[0];const points=[.03,.01,.02].map((lng,i)=>({...seed,id:String(i),lat:0,lng}));
    const result=await compareRoutes(points,{lat:0,lng:0});
    assert.equal(requests.length,2);assert.equal(result.suggested.distanceKm,10);
    assert.deepEqual(result.originalIds,result.suggestedIds);
    const w={points,collections:[],plan:{ids:result.suggestedIds,originalIds:result.originalIds,date:'2026-09-19',optimized:true,comparison:result}};
    const collected=completeCollection(w,points.map(p=>p.id),'2026-09-19T00:00:00Z',9.5);
    assert.equal(collected.collections[0].route.original.distanceKm,10);
    assert.equal(collected.collections[0].actualDistanceKm,9.5);
    assert.equal(completeCollection(w,[points[0].id]).collections[0].route,undefined);
  }finally{globalThis.fetch=fetchBefore;}
});
test('routing never transmits exact residential coordinates (mocked provider)',async()=>{
  const fetchBefore=globalThis.fetch,requests=[];
  globalThis.fetch=async(_url,options)=>{requests.push(JSON.parse(options.body));return Response.json({distanceKm:1,durationMinutes:3,geometry:[[-38.52,-3.73],[-38.53,-3.74]],provider:'OSRM',calculatedAt:'2026-09-19T00:00:00Z'});};
  try{const p={...seedPoints()[0],type:'Residência',lat:-3.734561,lng:-38.523876};const result=await compareRoutes([p],{lat:-3.74,lng:-38.53});assert.deepEqual(requests[0].coordinates[1],{lat:-3.73,lng:-38.52});assert.equal(result.approximateResidential,true);}
  finally{globalThis.fetch=fetchBefore;}
});
test('fingerprint is stable across saved cooperative metadata but invalidates changed route endpoints',()=>{
  const points=seedPoints(),start={lat:-3.74,lng:-38.53};
  assert.equal(routeFingerprint(points,start),routeFingerprint(points,{...start,name:'Cooperativa'}));
  assert.notEqual(routeFingerprint(points,start),routeFingerprint(points,{...start,lat:-3.75}));
});
