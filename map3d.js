const MAPLIBRE_VERSION='6.8.0';
const MAPLIBRE_MODULE=`https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.mjs`;
const MAPLIBRE_CSS=`https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;
const ERGATES_VIEW={center:[33.2425,35.0555],zoom:13.85,pitch:58,bearing:-24};

const htmlEscape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const numberFormat=new Intl.NumberFormat('el-CY',{maximumFractionDigits:2});
const euroFormat=new Intl.NumberFormat('el-CY',{style:'currency',currency:'EUR',maximumFractionDigits:0});
const values=(property,key)=>(property.facts[key]||[]).map(entry=>entry.value);
const numericValues=(property,key)=>values(property,key).filter(value=>typeof value==='number');
const unique=items=>[...new Set(items)];
const propertyKind=property=>property.type==='plot'?'Οικόπεδο':'Οικιστικό χωράφι';
const valueRange=(items,formatter)=>{const ordered=unique(items).sort((a,b)=>a-b);return ordered.length===0?'Δεν αναφέρεται':ordered.length===1?formatter(ordered[0]):`${formatter(ordered[0])} – ${formatter(ordered.at(-1))}`;};
const areaText=property=>valueRange(numericValues(property,'area'),value=>numberFormat.format(value));
const priceText=property=>numericValues(property,'price').length?valueRange(numericValues(property,'price'),value=>euroFormat.format(value)):'Τιμή κατόπιν επικοινωνίας';
const minimumNumeric=(property,key)=>{const items=numericValues(property,key);return items.length?Math.min(...items):null;};

export function uniquePropertyCoordinates(property){
 const seen=new Set();
 return property.sources.flatMap(source=>{
  const coordinate=source.coordinates;
  if(!coordinate||!Number.isFinite(coordinate.lat)||!Number.isFinite(coordinate.lng))return [];
  const key=`${coordinate.lat.toFixed(7)},${coordinate.lng.toFixed(7)}`;
  if(seen.has(key))return [];
  seen.add(key);
  return [{...coordinate,sourceId:source.id,sourceName:source.source,key}];
 });
}

export function buildLandPinGeoJSON(properties){
 const features=[];
 properties.forEach((property,propertyIndex)=>{
  uniquePropertyCoordinates(property).forEach((coordinate,pinIndex)=>{
   const accuracy=coordinate.accuracy==='exact'?'exact':coordinate.accuracy==='published'?'published':'approximate';
   features.push({
    type:'Feature',
    id:features.length,
    geometry:{type:'Point',coordinates:[coordinate.lng,coordinate.lat]},
    properties:{
     propertyId:property.id,
     propertyNumber:propertyIndex+1,
     pinIndex:pinIndex+1,
     accuracy,
     conflict:Boolean(property.coordinateConflict),
     category:property.coordinateConflict?'unsure':property.type==='plot'?'house':'field',
     iconKey:property.coordinateConflict?'pin-unsure':property.type==='plot'?'pin-house':'pin-field',
     label:String(propertyIndex+1),
     kind:propertyKind(property),
     area:areaText(property),
     sourceName:coordinate.sourceName||'Πηγή αγγελίας'
    }
   });
  });
 });
 return {type:'FeatureCollection',features};
}

export function summarizeMapProperties(properties){
 const mapped=properties.filter(property=>uniquePropertyCoordinates(property).length>0);
 const pins=buildLandPinGeoJSON(properties).features;
 return {
  total:properties.length,
  mapped:mapped.length,
  unmapped:properties.length-mapped.length,
  pins:pins.length,
  exactProperties:mapped.filter(property=>property.exactCoordinates).length,
  conflictingProperties:mapped.filter(property=>property.coordinateConflict).length
 };
}

export function buildConceptualBuildingGeoJSON(properties){
 const features=[];
 properties.forEach((property,propertyIndex)=>{
  const landArea=minimumNumeric(property,'area');
  const coverage=minimumNumeric(property,'coverage');
  const publishedHeight=minimumNumeric(property,'height');
  const floors=minimumNumeric(property,'floors');
  if(!landArea||!coverage||(!publishedHeight&&!floors))return;
  const height=publishedHeight||floors*3;
  const heightBasis=publishedHeight?'published-height':'floors-at-3m-concept';
  const footprintArea=landArea*coverage/100;
  const width=Math.sqrt(footprintArea*1.45),depth=footprintArea/width;
  uniquePropertyCoordinates(property).forEach(coordinate=>{
   const halfLng=width/2/(111320*Math.cos(coordinate.lat*Math.PI/180));
   const halfLat=depth/2/111320;
   features.push({type:'Feature',id:features.length,geometry:{type:'Polygon',coordinates:[[
    [coordinate.lng-halfLng,coordinate.lat-halfLat],[coordinate.lng+halfLng,coordinate.lat-halfLat],
    [coordinate.lng+halfLng,coordinate.lat+halfLat],[coordinate.lng-halfLng,coordinate.lat+halfLat],
    [coordinate.lng-halfLng,coordinate.lat-halfLat]
   ]]},properties:{propertyId:property.id,propertyNumber:propertyIndex+1,height,coverage,footprintArea:Math.round(footprintArea),heightBasis,label:'ΕΝΔΕΙΚΤΙΚΟ 3D'}});
  });
 });
 return {type:'FeatureCollection',features};
}

async function loadOfficialLandParcels(){
 try{
  const response=await fetch(new URL('./data/land-parcels.geojson',import.meta.url));
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const data=await response.json();
  return Array.isArray(data.features)?data:{type:'FeatureCollection',features:[]};
 }catch(error){console.warn('Official DLS parcel overlays unavailable',error);return {type:'FeatureCollection',features:[]};}
}

function injectMapLibreCSS(){
 if(document.querySelector('link[data-maplibre-3d]'))return;
 const link=document.createElement('link');
 link.rel='stylesheet';link.href=MAPLIBRE_CSS;link.dataset.maplibre3d='';
 document.head.append(link);
}

function cubeIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 8 4.5v10L12 21l-8-4.5v-10L12 2Z"/><path d="m4.5 6.8 7.5 4.3 7.5-4.3M12 11.1V21"/></svg>';}
function closeIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';}
function locateIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></svg>';}
function listIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>';}
function housePinIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 11 8-7 8 7v9H4v-9Z"/><path d="M9 20v-6h6v6"/></svg>';}
function fieldPinIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V9"/><path d="M12 13c-5 0-7-3-7-7 5 0 7 3 7 7Zm0 3c5 0 7-3 7-7-5 0-7 3-7 7ZM4 21h16"/></svg>';}
function unsurePinIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.4 9a3 3 0 1 1 4.8 2.4c-1.5 1-2.2 1.6-2.2 3.1"/><circle cx="12" cy="19" r="1"/></svg>';}

function dialogMarkup(summary){
 return `<dialog class="map3d-dialog" aria-labelledby="map3d-title">
  <div class="map3d-shell">
   <header class="map3d-header">
    <div class="map3d-title-wrap">${cubeIcon()}<div><strong id="map3d-title">3D Εργάτες</strong><span>${summary.mapped} από ${summary.total} ακίνητα · πραγματικό ανάγλυφο και 3D κτίρια</span></div></div>
    <div class="map3d-header-actions">
     <button type="button" class="map3d-list-button" aria-label="Όλα τα ακίνητα">${listIcon()}<span>Όλα τα ακίνητα</span></button>
     <button type="button" class="map3d-reset-button" aria-label="Επαναφορά 3D προβολής" title="Επαναφορά 3D προβολής">${locateIcon()}</button>
     <button type="button" class="map3d-close-button" aria-label="Κλείσιμο 3D χάρτη" title="Κλείσιμο">${closeIcon()}</button>
    </div>
   </header>
   <div class="map3d-stage">
    <div class="map3d-map" aria-label="Διαδραστικός τρισδιάστατος δορυφορικός χάρτης των Εργατών"></div>
    <div class="map3d-loading" role="status"><span></span><strong>Φόρτωση 3D εδάφους…</strong></div>
    <div class="map3d-help"><strong>Ζωντανή 3D περιοχή</strong><span>Σύρε: μετακίνηση · δεξί σύρσιμο ή δύο δάχτυλα: περιστροφή · ροδέλα ή τσίμπημα: zoom</span></div>
    <div class="map3d-legend" aria-label="Υπόμνημα πινέζων">
     <div class="map3d-legend-row"><strong>Τύπος</strong><span><b class="pin-kind">${housePinIcon()}</b> Οικόπεδο</span><span><b class="pin-kind">${fieldPinIcon()}</b> Οικιστικό χωράφι</span><span><b class="pin-kind unsure">${unsurePinIcon()}</b> Αβέβαιη θέση</span></div>
     <div class="map3d-legend-row"><strong>Ακρίβεια</strong><span><i class="legend-dot exact"></i> Πηγή: ακριβής</span><span><i class="legend-dot approximate"></i> Κατά προσέγγιση</span><span><i class="legend-dot conflict"></i> Πηγές διαφωνούν</span></div>
    </div>
    <aside class="map3d-panel" aria-label="Στοιχεία ακινήτου" aria-live="polite" hidden></aside>
   </div>
  </div>
 </dialog>`;
}

function markerAccuracy(property,coordinate){
 if(property.coordinateConflict)return '⚠️ Οι πηγές δείχνουν διαφορετικές πινέζες. Η συγκεκριμένη θέση χρειάζεται επιβεβαίωση.';
 if(coordinate?.accuracy==='exact')return 'Η πηγή δηλώνει αυτή τη συντεταγμένη ως ακριβή.';
 if(coordinate?.accuracy==='published')return 'Δημοσιευμένη πινέζα αγγελίας· δεν επιβεβαιώθηκε κτηματολογικά.';
 return coordinate?'Κατά προσέγγιση δημοσιευμένη θέση· δεν δείχνει κατ’ ανάγκη τα όρια του τεμαχίου.':'Η ακριβής θέση δεν δημοσιεύεται. Το ακίνητο παραμένει στη λίστα χωρίς πινέζα.';
}

function panelPhoto(property){
 const image=property.images[0];
 return image?`<img src="${htmlEscape(image.localPath||image.url)}" alt="Φωτογραφία αγγελίας για ${htmlEscape(propertyKind(property))} ${htmlEscape(areaText(property))} τ.μ." loading="lazy">`:'<div class="map3d-no-photo">Δεν δημοσιεύεται φωτογραφία</div>';
}

function propertyPanelMarkup(property,index,total,coordinate,land3D){
 const zones=unique(values(property,'zone'));
 const coordinateCount=uniquePropertyCoordinates(property).length;
 const mapsUrl=coordinate?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${coordinate.lat},${coordinate.lng}`)}`:'';
 return `<div class="map3d-panel-head"><span>Ακίνητο ${index+1} / ${total}</span><button type="button" class="map3d-panel-close" aria-label="Κλείσιμο στοιχείων">${closeIcon()}</button></div>
  <div class="map3d-panel-scroll">
   <div class="map3d-panel-photo">${panelPhoto(property)}</div>
   <p class="map3d-kicker">${htmlEscape(propertyKind(property))} · Εργάτες</p>
   <h2>${htmlEscape(areaText(property))} τ.μ.</h2>
   <span class="map3d-price-label">Ζητούμενη τιμή</span><strong class="map3d-price">${htmlEscape(priceText(property))}</strong>
   <div class="map3d-panel-badges">${zones.map(zone=>`<span>${htmlEscape(zone)}</span>`).join('')}${property.titleStated?'<span>Τίτλος</span>':''}${property.isShare?'<span class="warning">Μερίδιο</span>':''}${property.landlocked?'<span class="warning">Περίκλειστο</span>':''}</div>
   <p class="map3d-location-note">${htmlEscape(markerAccuracy(property,coordinate))}</p>
   ${land3D.officialParcels.length?`<div class="map3d-3d-note verified"><strong>Πραγματικό 3D τεμάχιο Κτηματολογίου</strong><p>Το επίσημο περίγραμμα κάτω από την πινέζα ταυτίστηκε με ${land3D.officialParcels.some(item=>item.properties.matchReason.includes('parcel-number'))?'τον δημοσιευμένο αριθμό τεμαχίου':'το δημοσιευμένο εμβαδό'}. Προβάλλεται ως υπερυψωμένη γαλάζια επιφάνεια.</p></div>`:''}
   ${land3D.concept?`<div class="map3d-3d-note concept"><strong>Ενδεικτικός 3D όγκος δόμησης</strong><p>${numberFormat.format(land3D.concept.properties.footprintArea)} τ.μ. κάλυψη · ${numberFormat.format(land3D.concept.properties.height)} μ. ύψος. Σχηματική απεικόνιση από τα δημοσιευμένα πολεοδομικά στοιχεία — όχι αρχιτεκτονικό σχέδιο ή πραγματική θέση κτιρίου.</p></div>`:'<div class="map3d-3d-note unavailable"><strong>Δεν εμφανίζεται ενδεικτικό κτίριο</strong><p>Λείπουν δημοσιευμένα στοιχεία κάλυψης ή ύψους/ορόφων για ασφαλή υπολογισμό.</p></div>'}
   ${coordinateCount>1?`<p class="map3d-coordinate-count">${coordinateCount} διαφορετικές δημοσιευμένες πινέζες για αυτό το ακίνητο εμφανίζονται στον χάρτη.</p>`:''}
   <div class="map3d-panel-actions">
    <a class="map3d-primary" href="property.html?id=${encodeURIComponent(property.id)}">Πλήρη στοιχεία ακινήτου</a>
    ${mapsUrl?`<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">Άνοιγμα στο Google Maps</a>`:''}
   </div>
  </div>`;
}

function propertyListMarkup(properties,summary){
 return `<div class="map3d-panel-head"><span>Και τα ${summary.total} ακίνητα</span><button type="button" class="map3d-panel-close" aria-label="Κλείσιμο λίστας">${closeIcon()}</button></div>
  <div class="map3d-list-tools"><input type="search" class="map3d-search" placeholder="Εμβαδό, τιμή ή ζώνη…" aria-label="Αναζήτηση ακινήτων"><p>${summary.mapped} με πινέζα · ${summary.unmapped} χωρίς δημοσιευμένη θέση</p></div>
  <div class="map3d-property-list" role="list"></div>`;
}

function searchableText(property){return [propertyKind(property),areaText(property),priceText(property),...values(property,'zone'),property.titleStated?'τίτλος':'',property.isShare?'μερίδιο':'',property.landlocked?'περίκλειστο':''].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function propertyListItems(properties,query=''){
 const normalized=query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 return properties.map((property,index)=>({property,index})).filter(({property})=>!normalized||searchableText(property).includes(normalized)).map(({property,index})=>{
  const coordinateCount=uniquePropertyCoordinates(property).length;
  return `<button type="button" class="map3d-property-row" data-property-id="${htmlEscape(property.id)}" role="listitem"><span class="map3d-property-number">${index+1}</span><span><strong>${htmlEscape(areaText(property))} τ.μ. · ${htmlEscape(propertyKind(property))}</strong><small>${htmlEscape(priceText(property))}</small><em class="${coordinateCount?'mapped':'unmapped'}">${coordinateCount?`${coordinateCount} ${coordinateCount===1?'πινέζα':'πινέζες'}`:'Χωρίς δημοσιευμένη θέση'}</em></span></button>`;
 }).join('')||'<p class="map3d-list-empty">Δεν βρέθηκε ακίνητο με αυτά τα στοιχεία.</p>';
}

function mapStyle(){return {
 version:8,
 glyphs:'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
 sources:{
  satellite:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19,attribution:'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'},
  terrain:{type:'raster-dem',url:'https://tiles.mapterhorn.com/tilejson.json',tileSize:512,maxzoom:14,attribution:'Terrain © MapTiler © OpenStreetMap contributors'},
  terrainShade:{type:'raster-dem',url:'https://tiles.mapterhorn.com/tilejson.json',tileSize:512,maxzoom:14},
  openfreemap:{type:'vector',url:'https://tiles.openfreemap.org/planet',attribution:'Map data © OpenStreetMap contributors'}
 },
 layers:[
  {id:'satellite',type:'raster',source:'satellite',paint:{'raster-saturation':.08,'raster-contrast':.1}},
  {id:'terrain-shading',type:'hillshade',source:'terrainShade',paint:{'hillshade-exaggeration':.28,'hillshade-shadow-color':'#172d32','hillshade-highlight-color':'#fff4d6','hillshade-accent-color':'#355d54'}}
 ],
 light:{anchor:'map',color:'#fff2d8',intensity:.62,position:[1.15,210,35]},
 sky:{'sky-color':'#b8d8eb','horizon-color':'#f5f0df','fog-color':'#d8e5e7','sky-horizon-blend':.35,'horizon-fog-blend':.25,'fog-ground-blend':.55,'atmosphere-blend':.7}
};}

function addRealismLayers(map){
 const roadFilter=['all',['==',['geometry-type'],'LineString'],['in',['get','class'],['literal',['motorway','trunk','primary','secondary','tertiary','minor','service']]]];
 map.addLayer({id:'real-buildings',type:'fill-extrusion',source:'openfreemap','source-layer':'building',minzoom:13.4,filter:['all',['!=',['get','hide_3d'],true],['has','render_height']],paint:{
  'fill-extrusion-color':['interpolate',['linear'],['get','render_height'],0,'#d6c39d',12,'#e2d1b1',35,'#efe4cf'],
  'fill-extrusion-height':['interpolate',['linear'],['zoom'],13.4,0,14.4,['get','render_height']],
  'fill-extrusion-base':['coalesce',['get','render_min_height'],0],
  'fill-extrusion-opacity':.86,
  'fill-extrusion-vertical-gradient':true
 }});
 map.addLayer({id:'real-road-casing',type:'line',source:'openfreemap','source-layer':'transportation',minzoom:12,filter:roadFilter,paint:{'line-color':'rgba(25,35,37,.78)','line-width':['interpolate',['linear'],['zoom'],12,.9,16,5.8],'line-opacity':.58}});
 map.addLayer({id:'real-roads',type:'line',source:'openfreemap','source-layer':'transportation',minzoom:12,filter:roadFilter,paint:{'line-color':'#f2dfb9','line-width':['interpolate',['linear'],['zoom'],12,.45,16,3.5],'line-opacity':.82}});
 map.addLayer({id:'real-place-labels',type:'symbol',source:'openfreemap','source-layer':'place',minzoom:11,filter:['in',['get','class'],['literal',['town','village','suburb','quarter','hamlet','neighbourhood']]],layout:{'text-field':['coalesce',['get','name:el'],['get','name']],'text-font':['Open Sans Semibold'],'text-size':['interpolate',['linear'],['zoom'],11,13,16,17],'text-letter-spacing':.02,'text-padding':4},paint:{'text-color':'#fffdf5','text-halo-color':'rgba(12,28,32,.9)','text-halo-width':2,'text-halo-blur':.5}});
}

function addLand3DLayers(map,officialParcels,conceptualBuildings){
 map.addSource('official-land-parcels',{type:'geojson',data:officialParcels});
 map.addSource('conceptual-buildings',{type:'geojson',data:conceptualBuildings});
 const hidden=['==',['get','propertyId'],''];
 map.addLayer({id:'official-land-slabs',type:'fill-extrusion',source:'official-land-parcels',filter:hidden,paint:{'fill-extrusion-color':'#26d5c2','fill-extrusion-height':2.2,'fill-extrusion-base':.15,'fill-extrusion-opacity':.62,'fill-extrusion-vertical-gradient':true}});
 map.addLayer({id:'official-land-outline',type:'line',source:'official-land-parcels',filter:hidden,paint:{'line-color':'#7ffff2','line-width':4,'line-opacity':1}});
 map.addLayer({id:'conceptual-building',type:'fill-extrusion',source:'conceptual-buildings',filter:hidden,paint:{'fill-extrusion-color':'#53a7ff','fill-extrusion-height':['get','height'],'fill-extrusion-base':2.3,'fill-extrusion-opacity':.78,'fill-extrusion-vertical-gradient':true}});
 map.addLayer({id:'conceptual-building-roof',type:'fill-extrusion',source:'conceptual-buildings',filter:hidden,paint:{'fill-extrusion-color':'#dff7ff','fill-extrusion-height':['+',['get','height'],.45],'fill-extrusion-base':['get','height'],'fill-extrusion-opacity':.94}});
 map.addLayer({id:'conceptual-building-label',type:'symbol',source:'conceptual-buildings',filter:hidden,layout:{'text-field':['get','label'],'text-font':['Open Sans Semibold'],'text-size':12,'text-offset':[0,-1.2],'text-allow-overlap':true},paint:{'text-color':'#ffffff','text-halo-color':'#0b3549','text-halo-width':2}});
}

function addLandLayers(map,pinData){
 const createIcon=(name,draw)=>{
  const canvas=document.createElement('canvas');canvas.width=48;canvas.height=48;
  const context=canvas.getContext('2d');context.strokeStyle='#fff';context.fillStyle='#fff';context.lineWidth=5;context.lineCap='round';context.lineJoin='round';
  draw(context);map.addImage(name,context.getImageData(0,0,48,48),{pixelRatio:2});
 };
 createIcon('pin-house',context=>{context.beginPath();context.moveTo(7,23);context.lineTo(24,8);context.lineTo(41,23);context.stroke();context.beginPath();context.rect(11,22,26,19);context.moveTo(21,41);context.lineTo(21,29);context.lineTo(28,29);context.lineTo(28,41);context.stroke();});
 createIcon('pin-field',context=>{context.beginPath();context.moveTo(24,42);context.lineTo(24,16);context.stroke();context.beginPath();context.moveTo(24,28);context.bezierCurveTo(13,28,8,22,8,13);context.bezierCurveTo(18,13,24,18,24,28);context.fill();context.beginPath();context.moveTo(24,33);context.bezierCurveTo(35,33,40,27,40,18);context.bezierCurveTo(30,18,24,23,24,33);context.fill();context.beginPath();context.moveTo(7,42);context.lineTo(41,42);context.stroke();});
 createIcon('pin-unsure',context=>{context.font='700 38px Arial';context.textAlign='center';context.textBaseline='middle';context.fillText('?',24,25);});
 map.addSource('land-pins',{type:'geojson',data:pinData});
 map.addLayer({id:'land-pin-halo',type:'circle',source:'land-pins',paint:{'circle-radius':22,'circle-color':'rgba(255,255,255,.9)','circle-stroke-width':2,'circle-stroke-color':'rgba(14,39,48,.5)'}});
 map.addLayer({id:'land-pins',type:'circle',source:'land-pins',paint:{'circle-radius':18,'circle-color':['case',['get','conflict'],'#c84735',['==',['get','accuracy'],'exact'],'#14836f','#e7a52d'],'circle-stroke-width':2,'circle-stroke-color':'#fff'}});
 map.addLayer({id:'land-pin-icons',type:'symbol',source:'land-pins',layout:{'icon-image':['get','iconKey'],'icon-size':.82,'icon-offset':[0,-4],'icon-allow-overlap':true,'icon-ignore-placement':true}});
 map.addLayer({id:'land-pin-labels',type:'symbol',source:'land-pins',layout:{'text-field':['get','label'],'text-size':10,'text-font':['Open Sans Semibold'],'text-offset':[0,.9],'text-allow-overlap':true,'text-ignore-placement':true},paint:{'text-color':'#fff','text-halo-color':'rgba(0,0,0,.5)','text-halo-width':1}});
 map.addLayer({id:'selected-pin',type:'circle',source:'land-pins',filter:['==',['get','propertyId'],''],paint:{'circle-radius':26,'circle-color':'rgba(255,255,255,0)','circle-stroke-width':4,'circle-stroke-color':'#fff'}});
}

export async function createErgates3D(properties){
 injectMapLibreCSS();
 const summary=summarizeMapProperties(properties);
 const pinData=buildLandPinGeoJSON(properties);
 const officialParcels=await loadOfficialLandParcels();
 const conceptualBuildings=buildConceptualBuildingGeoJSON(properties);
 const wrapper=document.createElement('div');wrapper.innerHTML=dialogMarkup(summary);
 const dialog=wrapper.firstElementChild;document.body.append(dialog);
 const panel=dialog.querySelector('.map3d-panel');
 let map=null;let maplibregl=null;let focusedBeforeOpen=null;let selectedPropertyId=null;

 const setSelected3DFilters=propertyId=>{
  for(const layer of ['official-land-slabs','official-land-outline','conceptual-building','conceptual-building-roof','conceptual-building-label'])if(map?.getLayer(layer))map.setFilter(layer,['==',['get','propertyId'],propertyId||'']);
 };
 const closePanel=()=>{panel.hidden=true;selectedPropertyId=null;if(map?.getLayer('selected-pin'))map.setFilter('selected-pin',['==',['get','propertyId'],'']);setSelected3DFilters('');};
 const focusProperty=(property,coordinate=null,fly=true)=>{
  const index=properties.findIndex(item=>item.id===property.id);
  const coordinates=uniquePropertyCoordinates(property);
  const pin=coordinate||coordinates[0]||null;
  const land3D={officialParcels:officialParcels.features.filter(feature=>feature.properties.propertyId===property.id),concept:conceptualBuildings.features.find(feature=>feature.properties.propertyId===property.id)||null};
  selectedPropertyId=property.id;panel.innerHTML=propertyPanelMarkup(property,index,properties.length,pin,land3D);panel.hidden=false;
  panel.querySelector('.map3d-panel-close').addEventListener('click',closePanel);
  if(map?.getLayer('selected-pin'))map.setFilter('selected-pin',['==',['get','propertyId'],property.id]);
  setSelected3DFilters(property.id);
  if(fly&&pin&&map)map.flyTo({center:[pin.lng,pin.lat],zoom:Math.max(map.getZoom(),18.2),pitch:68,bearing:map.getBearing(),offset:innerWidth<760?[0,-175]:[-110,0],duration:900});
 };
 const openList=()=>{
  panel.innerHTML=propertyListMarkup(properties,summary);panel.hidden=false;
  panel.querySelector('.map3d-panel-close').addEventListener('click',closePanel);
  const search=panel.querySelector('.map3d-search'),list=panel.querySelector('.map3d-property-list');
  const render=()=>{list.innerHTML=propertyListItems(properties,search.value);};render();
  search.addEventListener('input',render);
  list.addEventListener('click',event=>{const row=event.target.closest('[data-property-id]');if(!row)return;const property=properties.find(item=>item.id===row.dataset.propertyId);if(property)focusProperty(property);});
 search.focus({preventScroll:true});
};
 const openLocationGroup=features=>{
  const seen=new Set();
  const choices=features.flatMap(feature=>{
   const propertyId=feature.properties?.propertyId;
   if(!propertyId||seen.has(propertyId))return [];
   seen.add(propertyId);
   const property=properties.find(item=>item.id===propertyId);
   return property?[{property,index:properties.indexOf(property),coordinates:feature.geometry.coordinates}]:[];
  });
  selectedPropertyId=null;
  panel.innerHTML=`<div class="map3d-panel-head"><span>${choices.length} ακίνητα στην ίδια πινέζα</span><button type="button" class="map3d-panel-close" aria-label="Κλείσιμο επιλογής">${closeIcon()}</button></div><p class="map3d-group-note">Η κοινή κατά προσέγγιση πινέζα προέρχεται από τις αγγελίες και δεν αποδεικνύει ότι τα τεμάχια βρίσκονται στο ίδιο ακριβές σημείο. Επίλεξε ακίνητο:</p><div class="map3d-property-list" role="list">${choices.map(({property,index},choiceIndex)=>`<button type="button" class="map3d-property-row" data-choice-index="${choiceIndex}" role="listitem"><span class="map3d-property-number">${index+1}</span><span><strong>${htmlEscape(areaText(property))} τ.μ. · ${htmlEscape(propertyKind(property))}</strong><small>${htmlEscape(priceText(property))}</small><em class="mapped">Δημοσιευμένη πινέζα</em></span></button>`).join('')}</div>`;
  panel.hidden=false;
  panel.querySelector('.map3d-panel-close').addEventListener('click',closePanel);
  panel.querySelector('.map3d-property-list').addEventListener('click',event=>{
   const row=event.target.closest('[data-choice-index]');if(!row)return;
   const choice=choices[Number(row.dataset.choiceIndex)];if(!choice)return;
   const [lng,lat]=choice.coordinates;
   const coordinate=uniquePropertyCoordinates(choice.property).find(item=>Math.abs(item.lng-lng)<1e-7&&Math.abs(item.lat-lat)<1e-7)||{lng,lat,accuracy:'approximate'};
   focusProperty(choice.property,coordinate,true);
  });
 };
const resetView=()=>map?.flyTo({...ERGATES_VIEW,duration:1000});
 const ensureMap=async()=>{
  if(map){map.resize();return;}
  maplibregl=await import(MAPLIBRE_MODULE);
  map=new maplibregl.Map({container:dialog.querySelector('.map3d-map'),style:mapStyle(),...ERGATES_VIEW,maxPitch:82,minZoom:10,maxZoom:19,antialias:true,attributionControl:false,maplibreLogo:true});
  map.addControl(new maplibregl.NavigationControl({visualizePitch:true,showZoom:true,showCompass:true}),'top-right');
  map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-left');
  map.on('load',()=>{
   map.setTerrain({source:'terrain',exaggeration:1.08});
   addRealismLayers(map);
   addLand3DLayers(map,officialParcels,conceptualBuildings);
   addLandLayers(map,pinData);
   dialog.querySelector('.map3d-loading').hidden=true;
  });
  const interactiveLayers=['land-pins','land-pin-icons','land-pin-labels','land-pin-halo'];
  map.on('mouseenter','land-pins',()=>{map.getCanvas().style.cursor='pointer';});
  map.on('mouseleave','land-pins',()=>{map.getCanvas().style.cursor='';});
  map.on('click',event=>{
   const rendered=map.queryRenderedFeatures(event.point,{layers:interactiveLayers}).filter(item=>item.properties?.propertyId);
   const features=[...new Map(rendered.map(feature=>[feature.properties.propertyId,feature])).values()];
   if(!features.length)return;
   if(features.length>1){openLocationGroup(features);return;}
   const feature=features[0];
   const property=properties.find(item=>item.id===feature.properties.propertyId);if(!property)return;
   const [lng,lat]=feature.geometry.coordinates;
   const coordinate=uniquePropertyCoordinates(property).find(item=>Math.abs(item.lng-lng)<1e-7&&Math.abs(item.lat-lat)<1e-7)||{lng,lat,accuracy:feature.properties.accuracy};
   focusProperty(property,coordinate,true);
  });
  map.on('moveend',()=>{window.dispatchEvent(new CustomEvent('ergates-3d-state-change'));});
 };
 dialog.querySelector('.map3d-close-button').addEventListener('click',()=>dialog.close());
 dialog.querySelector('.map3d-panel').addEventListener('click',event=>event.stopPropagation());
 dialog.querySelector('.map3d-list-button').addEventListener('click',openList);
 dialog.querySelector('.map3d-reset-button').addEventListener('click',resetView);
 dialog.addEventListener('close',()=>{closePanel();document.body.classList.remove('map3d-open');focusedBeforeOpen?.focus({preventScroll:true});});
 dialog.addEventListener('keydown',event=>{
  if(event.key.toLowerCase()==='f'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.target.tagName!=='INPUT'){
   event.preventDefault();if(document.fullscreenElement)document.exitFullscreen();else dialog.requestFullscreen?.();
  }
 });
 const open=async()=>{
  focusedBeforeOpen=document.activeElement;dialog.showModal();document.body.classList.add('map3d-open');
  try{await ensureMap();}catch(error){dialog.querySelector('.map3d-loading').innerHTML='<strong>Ο 3D χάρτης δεν φορτώθηκε.</strong><span>Έλεγξε τη σύνδεση στο διαδίκτυο και δοκίμασε ξανά.</span>';console.error('Ergates 3D map failed',error);}
  dialog.querySelector('.map3d-close-button').focus({preventScroll:true});
 };
 window.render_game_to_text=()=>JSON.stringify({mode:dialog.open?'ergates-3d-map':'catalogue',coordinateSystem:'Geographic coordinates [longitude, latitude]. North is up only when bearing is 0.',properties:summary.total,mappedProperties:summary.mapped,uniquePublishedPins:summary.pins,pinCategories:Object.fromEntries(['house','field','unsure'].map(category=>[category,pinData.features.filter(feature=>feature.properties.category===category).length])),selectedPropertyId,land3D:{officialMatchedParcels:officialParcels.features.length,officialMatchedProperties:new Set(officialParcels.features.map(feature=>feature.properties.propertyId)).size,conceptualBuildingVolumes:conceptualBuildings.features.length,conceptualBuildingProperties:new Set(conceptualBuildings.features.map(feature=>feature.properties.propertyId)).size,selectedOfficialParcel:Boolean(selectedPropertyId&&officialParcels.features.some(feature=>feature.properties.propertyId===selectedPropertyId)),selectedConceptualBuilding:Boolean(selectedPropertyId&&conceptualBuildings.features.some(feature=>feature.properties.propertyId===selectedPropertyId))},realism:map?{terrain:Boolean(map.getTerrain()),buildings:Boolean(map.getLayer('real-buildings')),visible3DBuildings:map.getLayer('real-buildings')?map.queryRenderedFeatures({layers:['real-buildings']}).length:0,roads:Boolean(map.getLayer('real-roads')),placeLabels:Boolean(map.getLayer('real-place-labels'))}:null,camera:map?{center:[map.getCenter().lng,map.getCenter().lat],zoom:map.getZoom(),pitch:map.getPitch(),bearing:map.getBearing()}:null});
 window.advanceTime=()=>map?.triggerRepaint();
 return {open,close:()=>dialog.close(),summary,get map(){return map;}};
}
