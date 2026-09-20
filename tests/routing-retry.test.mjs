import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchRoadRoute} from '../lib/routing.ts';

test('road throttling retries once, respects cancellation and reports persistent failures',async()=>{
 const original=globalThis.fetch;
 try {
  let calls=0;
  globalThis.fetch=async()=>{calls++;return calls===1?Response.json({error:'Aguarde'},{status:429}):Response.json({distanceKm:2,provider:'OSRM'});};
  assert.equal((await fetchRoadRoute([{lat:0,lng:0}])).distanceKm,2);
  assert.equal(calls,2);
  calls=0;globalThis.fetch=async()=>{calls++;return Response.json({error:'Ainda limitado'},{status:429});};
  await assert.rejects(()=>fetchRoadRoute([{lat:0,lng:0}]),/Ainda limitado/);assert.equal(calls,2);
  calls=0;const controller=new AbortController();
  globalThis.fetch=async()=>{calls++;controller.abort();return Response.json({error:'Aguarde'},{status:429});};
  await assert.rejects(()=>fetchRoadRoute([{lat:0,lng:0}],controller.signal),{name:'AbortError'});assert.equal(calls,1);
 } finally {globalThis.fetch=original;}
});
