import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildConceptualBuildingGeoJSON,buildLandPinGeoJSON,summarizeMapProperties,uniquePropertyCoordinates} from '../map3d.js';

const data=JSON.parse(await readFile(new URL('../data/properties.json',import.meta.url),'utf8'));
const properties=data.properties;
const officialParcels=JSON.parse(await readFile(new URL('../data/land-parcels.geojson',import.meta.url),'utf8'));

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
  assert.ok(['house','field','unsure'].includes(feature.properties.category));
  assert.equal(feature.properties.iconKey,`pin-${feature.properties.category}`);
  if(feature.properties.conflict)assert.equal(feature.properties.category,'unsure');
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

test('one primary marker per mapped property hides alternatives until selection',()=>{
 const features=buildLandPinGeoJSON(properties).features;
 const primary=features.filter(feature=>feature.properties.isPrimary);
 const alternatives=features.filter(feature=>!feature.properties.isPrimary);
 assert.equal(primary.length,53);
 assert.equal(alternatives.length,48);
 assert.equal(primary.filter(feature=>feature.properties.category==='unsure').length,27);
 assert.equal(primary.filter(feature=>feature.properties.propertyType==='plot').length,17);
 assert.equal(primary.filter(feature=>feature.properties.propertyType==='field').length,36);
 for(const property of properties){
  const pins=features.filter(feature=>feature.properties.propertyId===property.id);
  if(!pins.length)continue;
  assert.equal(pins.filter(feature=>feature.properties.isPrimary).length,1,property.id);
  assert.equal(pins.find(feature=>feature.properties.isPrimary).properties.alternativeCount,pins.length-1,property.id);
 }
});

test('conceptual 3D buildings use only published planning values',()=>{
 const geojson=buildConceptualBuildingGeoJSON(properties);
 assert.equal(geojson.features.length,86);
 assert.equal(new Set(geojson.features.map(feature=>feature.properties.propertyId)).size,41);
 for(const feature of geojson.features){
  const property=properties.find(item=>item.id===feature.properties.propertyId);
  const coverages=(property.facts.coverage||[]).map(item=>Number(item.value));
  const heights=(property.facts.height||[]).map(item=>Number(item.value));
  const floors=(property.facts.floors||[]).map(item=>Number(item.value));
  assert.equal(feature.properties.coverage,Math.min(...coverages));
  assert.ok(heights.includes(feature.properties.height)||floors.some(value=>value*3===feature.properties.height));
 }
});

test('official 3D land slabs have a reproducible cadastral match',()=>{
 assert.equal(officialParcels.features.length,11);
 assert.equal(new Set(officialParcels.features.map(feature=>feature.properties.propertyId)).size,10);
 for(const feature of officialParcels.features){
  const property=properties.find(item=>item.id===feature.properties.propertyId);
  assert.ok(property,'official parcel property must exist');
  const numberMatch=feature.properties.listedParcelNumbers.includes(feature.properties.officialParcelNumber);
  const areaMatch=feature.properties.listedAreas.some(area=>Math.abs(area-feature.properties.officialArea)<=Math.max(10,area*.03));
  assert.ok(numberMatch||areaMatch,property.id+' needs parcel-number or area match');
 }
});
