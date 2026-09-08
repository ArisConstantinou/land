import {readFile,writeFile} from 'node:fs/promises';

const SERVICE='https://eservices.dls.moi.gov.cy/inspire/rest/services/INSPIRE/CP_CadastralParcels/MapServer/1/query';
const catalogue=JSON.parse(await readFile(new URL('../data/properties.json',import.meta.url),'utf8'));
const pinRecords=[];
const servicePoints=[];
const globalPins=new Set();

for(const [propertyIndex,property] of catalogue.properties.entries()){
 const localPins=new Set();
 for(const source of property.sources){
  const coordinate=source.coordinates;
  if(!coordinate)continue;
  const pinKey=`${coordinate.lng.toFixed(7)},${coordinate.lat.toFixed(7)}`;
  if(localPins.has(pinKey))continue;
  localPins.add(pinKey);
  pinRecords.push({property,propertyIndex,coordinate,pinKey});
  if(!globalPins.has(pinKey)){globalPins.add(pinKey);servicePoints.push([coordinate.lng,coordinate.lat]);}
 }
}

const body=new URLSearchParams({
 geometry:JSON.stringify({points:servicePoints,spatialReference:{wkid:4326}}),
 geometryType:'esriGeometryMultipoint',
 inSR:'4326',
 spatialRel:'esriSpatialRelIntersects',
 outFields:'OBJECTID,areaValue,areaValue_uom,label,nationalCadastralRef,id_localId',
 returnGeometry:'true',
 outSR:'4326',
 f:'geojson'
});
const response=await fetch(SERVICE,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
if(!response.ok)throw new Error(`DLS request failed: ${response.status}`);
const parcels=await response.json();
if(!Array.isArray(parcels.features))throw new Error(`DLS response did not contain features: ${JSON.stringify(parcels.error||parcels)}`);

function ringContains([x,y],ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [xi,yi]=ring[i],[xj,yj]=ring[j];
  if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
 }
 return inside;
}

function geometryContains(point,geometry){
 if(geometry.type==='Polygon')return geometry.coordinates.some(ring=>ringContains(point,ring));
 if(geometry.type==='MultiPolygon')return geometry.coordinates.some(polygon=>polygon.some(ring=>ringContains(point,ring)));
 return false;
}

const matched=[];
const seenMatches=new Set();
for(const {property,propertyIndex,coordinate,pinKey} of pinRecords){
 const parcel=parcels.features.find(feature=>geometryContains([coordinate.lng,coordinate.lat],feature.geometry));
 if(!parcel)continue;
 const listedAreas=[...new Set((property.facts.area||[]).map(item=>Number(item.value)).filter(Number.isFinite))];
 const listedParcelNumbers=[...new Set([...(property.facts['extra.parcelNumber']||[]),...(property.facts['extra.plotNumber']||[])].map(item=>String(item.value)))];
 const officialArea=Number(parcel.properties.areaValue);
 const areaMatch=listedAreas.some(area=>Math.abs(area-officialArea)<=Math.max(10,area*.03));
 const parcelNumberMatch=listedParcelNumbers.includes(String(parcel.properties.label));
 if(!areaMatch&&!parcelNumberMatch)continue;
 const matchKey=`${property.id}:${parcel.properties.OBJECTID}`;
 if(seenMatches.has(matchKey))continue;
 seenMatches.add(matchKey);
 matched.push({
  ...parcel,
  properties:{
   propertyId:property.id,
   propertyNumber:propertyIndex+1,
   pinKey,
   coordinateAccuracy:coordinate.accuracy||'approximate',
   officialArea,
   officialParcelNumber:String(parcel.properties.label),
   nationalCadastralRef:parcel.properties.nationalCadastralRef,
   listedAreas,
   listedParcelNumbers,
   matchReason:areaMatch&&parcelNumberMatch?'parcel-number-and-area':parcelNumberMatch?'parcel-number':'area'
  }
 });
}

const output={
 type:'FeatureCollection',
 name:'Verified DLS parcels beneath published Ergates listing pins',
 source:'Department of Lands and Surveys, Republic of Cyprus — INSPIRE Cadastral Parcels',
 sourceUrl:SERVICE,
 generatedAt:new Date().toISOString(),
 matchingRule:'Included only when the official parcel number matches a published parcel number or official area is within 3% (minimum tolerance 10 m²) of a published listing area.',
 features:matched.sort((a,b)=>a.properties.propertyNumber-b.properties.propertyNumber||a.properties.officialParcelNumber.localeCompare(b.properties.officialParcelNumber))
};
await writeFile(new URL('../data/land-parcels.geojson',import.meta.url),`${JSON.stringify(output,null,2)}\n`);
console.log(`DLS parcel sync ready: ${matched.length} matched parcels for ${new Set(matched.map(feature=>feature.properties.propertyId)).size} properties from ${pinRecords.length} published pins.`);
