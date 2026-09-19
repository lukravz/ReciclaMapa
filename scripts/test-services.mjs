// Integration smoke test: only public/demonstrative Fortaleza coordinates; no personal data.
import assert from 'node:assert/strict';
const base='http://localhost:3001';
async function post(path,body){const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)});const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;}
const search=await post('/api/geocode',{street:'Rua Major Facundo',number:'',region:'Centro',city:'Fortaleza',state:'CE',postcode:'',residential:false});
assert.ok(search.length>0);assert.ok(Number.isFinite(search[0].lat));console.log('Geocoding OK:',search[0].label);
const reverse=await post('/api/reverse-geocode',{lat:-3.7327,lng:-38.5267,residential:false});
assert.ok(reverse.city);console.log('Reverse geocoding OK:',reverse.city,reverse.region);
const route=await post('/api/route',{coordinates:[{lat:-3.7463,lng:-38.5385},{lat:-3.7327,lng:-38.5267},{lat:-3.7234,lng:-38.5286},{lat:-3.7313,lng:-38.5361},{lat:-3.7259,lng:-38.5197},{lat:-3.7463,lng:-38.5385}]});
assert.equal(route.provider,'OSRM');assert.ok(route.distanceKm>0);assert.ok(route.geometry.length>2);console.log('Road routing OK:',route.distanceKm,'km,',route.geometry.length,'geometry coordinates');
const bad=await fetch(base+'/api/route',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({coordinates:[{lat:999,lng:0}]})});assert.equal(bad.status,400);console.log('Invalid coordinates correctly rejected.');
