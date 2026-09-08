import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildLandPinGeoJSON,summarizeMapProperties,uniquePropertyCoordinates} from '../map3d.js';

const data=JSON.parse(await readFile(new URL('../data/properties.json',import.meta.url),'utf8'));
const properties=data.properties;

test('3D map includes every property without inventing coordinates',()=>{
 const summary=summarizeMapProperties(properties);
 assert.deepEqual(summary,{total:69,mapped:53,unmapped:16,pins:101,exactProperties:15,conflictingProperties:27});
 const mappedIds=new Set(buildLandPinGeoJSON(properties).features.map(feature=>feature.properties.propertyId));
 for(const property of properties)assert.equal(mappedIds.has(property.id),uniquePropertyCoordinates(property).length>0,property.id);
});

test('every 3D marker is an existing published source coordinate',()=>{
 const geojson=buildLandPinGeoJSON(properties);
 for(const feature of geojson.features){
  const property=properties.find(item=>item.id===feature.properties.propertyId);
  const lng=feature.geometry.coordinates[0],lat=feature.geometry.coordinates[1];
  assert.ok(property,'marker property must exist');
  assert.ok(property.sources.some(source=>source.coordinates&&source.coordinates.lat===lat&&source.coordinates.lng===lng),property.id+' marker must come from a source');
  assert.ok(['exact','published','approximate'].includes(feature.properties.accuracy));
 }
});

test('marker categories preserve uncertainty and coordinate conflicts',()=>{
 const categories={exact:0,approximate:0,conflict:0,unmapped:0};
 for(const property of properties){
  const coordinates=uniquePropertyCoordinates(property);
  if(!coordinates.length)categories.unmapped++;
  else if(property.coordinateConflict)categories.conflict++;
  else if(property.exactCoordinates)categories.exact++;
  else categories.approximate++;
 }
 assert.deepEqual(categories,{exact:4,approximate:22,conflict:27,unmapped:16});
});

test('duplicate source coordinates collapse only within the same property',()=>{
 const geojson=buildLandPinGeoJSON(properties);
 const keys=new Set();
 for(const feature of geojson.features){
  const key=feature.properties.propertyId+':'+feature.geometry.coordinates.join(',');
  assert.equal(keys.has(key),false,'duplicate marker '+key);keys.add(key);
 }
 assert.equal(keys.size,101);
});
