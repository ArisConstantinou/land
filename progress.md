Original prompt: USE ALL LANDS AND PRODUCE A 3D AREA OF ERGATES WHICH CAN ROTATE, PAN AND ZOOM. ADD CLICKABLE LAND MARKERS THAT OPEN THE LAND PANEL, AND ADD A 3D BUTTON TO ENTER THIS FEATURE.

## Current implementation notes

- Baseline: clean `master`, 69 properties, local URL `http://127.0.0.1:5187/`.
- Coordinate audit: 53 properties have one or more published coordinates; 16 do not. The 3D map must never invent coordinates for the 16 unmapped properties.
- Google Photorealistic 3D Tiles require a billed Google Maps Platform project and API key. No key is configured in the repository or environment. Implementing a working key-free 3D satellite-terrain experience first, while keeping Google Maps links on every published pin.
- TODO: add 3D launcher, full-screen terrain map, 101 unique source pins, all-69 property browser, clickable property panel, tests, desktop/mobile browser QA, build, commit and push.

## Implemented

- Added the prominent «3D Χάρτης Εργατών» launcher and a full-screen 3D satellite-terrain experience.
- Added rotate, pan, zoom, compass/reset, 101 unique published source pins, shared-pin choice, exact/approximate/conflict legend, all-69 property browser, search, and compact property panels.
- No parcel polygon or missing coordinate was fabricated. The 16 unlocated properties remain accessible with explicit no-location labels.
- Added map data-integrity tests proving every marker is an existing source coordinate and preserving the 4 exact / 22 approximate / 27 conflicting / 16 unmapped categories.
- Current realism stack: Esri World Imagery, Mapterhorn elevation/hillshade, and OpenFreeMap/OpenStreetMap roads, Greek place labels and source-height 3D buildings, all with visible attribution. Google Photorealistic 3D remains unavailable without a billed API key.
- Real Chromium QA passed at 1280×720 and 390×844: terrain/buildings/roads/labels load, rotate/zoom/reset work, land clicks open the correct panel, Escape restores launcher focus, and mobile has no horizontal overflow.
- Validation passed: 11/11 tests, JavaScript syntax checks, production build and zero current browser console errors/warnings.
- TODO: commit/push and live GitHub Pages verification.

## 3D land and building-volume follow-up

- User requested 3D presence for the listed lands themselves, referencing a selected empty plot among extruded surrounding buildings.
- Added a reproducible Cyprus DLS INSPIRE parcel sync. It accepts a parcel only when its official parcel number matches a published number or its official area matches a published listing area within 3% (minimum 10 m² tolerance).
- Current verified result: 11 official polygons belonging to 10 listed properties. Other pin-underlying parcels are deliberately rejected rather than presented as the advertised property.
- Added 86 conceptual building volumes for 41 properties with published coverage plus published height/floors. Footprints and heights are data-derived, while placement and rectangular form are explicitly labeled schematic and non-architectural.
- Desktop and mobile Chromium QA passed for a property with both official parcel and conceptual building: auto-zoom, camera offset, parcel slab, building walls/roof, panel notes and text state agree. Mobile remains 390px wide without overflow and keeps the selected model above the bottom sheet.
- Negative case passed: a mapped listing without a safe parcel match or sufficient planning data displays neither fabricated geometry nor a conceptual building and explains why in its panel.
- Validation passed: 13/13 tests, syntax checks, build and zero browser console errors/warnings.
- TODO: commit, push and verify the new GitHub Pages deployment.

## Pin icon and legend follow-up

- User reported that numbered/color-only pins were not understandable and requested proper house, land/farm and unsure icons.
- Added data-derived pin categories: house for non-conflicting plots, sprout/field for non-conflicting residential fields, and question mark for every pin belonging to a property whose sources publish conflicting coordinates.
- Accuracy remains an independent color channel: green source-declared exact, amber approximate/published and red conflicting sources. The redesigned two-row legend explains both icon type and color accuracy.
- Current pin counts: 7 house, 19 field and 75 unsure, totaling the same 101 source-backed pins.
- Real-browser QA passed at 1280×720 and 390×844: icons and legend are readable, a pin click selects its property, and the mobile page has no horizontal overflow.
- Automated validation passed: JavaScript syntax, 13/13 tests, static build, and the game-state capture reports all 101 categorized pins.
- Asset versions bumped for the new 3D JavaScript and CSS.
- Committed and pushed to `main` as `3272f1a`. GitHub Pages built that commit successfully.
- Live public QA passed at 390×844: all three icon categories and both legend rows render, 3D terrain/buildings/roads/labels load, there is no horizontal overflow, and the console has zero errors or warnings.

## Primary-pin decluttering and tilt guidance

- Verified that 75 red markers represented 27 conflict properties because every alternative source coordinate was visible at once; the coordinates remain valid source evidence, but the default visualization over-counted uncertainty visually.
- Changed the default map to one primary marker per mapped property (53 visible). The most reliable published coordinate is chosen by declared accuracy and agreement count; all 48 alternatives remain preserved and appear only when that property is selected.
- Conflict pins now show a `+N` badge for hidden alternatives, and the property panel explains the smaller red alternative points after selection.
- Clarified the on-map tilt instructions for desktop right-drag and two-finger mobile gestures.
- Added icon filters for property type (all/plot/field) and location accuracy (all/exact/approximate/unsure), with combinable selections, active-filter badge, visible-pin counter and one-click reset.
- Automated validation passed: JavaScript syntax, 14/14 tests and static build.
- Desktop and 390×844 Chromium QA passed: plot + unsure produced 10/53 pins, reset restored 53/53, no horizontal overflow or console errors, and selecting a conflict pin revealed only its own alternative positions.
- Asset versions bumped for the updated 3D JavaScript and CSS.
- Initial icon-filter release was committed and pushed to `main` as `4f01492`; GitHub Pages built it successfully.
- Follow-up research found the current official Cyprus DLS `National/Topography_EN` ArcGIS MapServer (server version 10.91), containing road/hydrographic networks, spot heights, altitude tints and Contour Lines 1993. The DLS catalogue says API access should be arranged with its portal administrator, and the August 2026 map price list confirms that available printed/PDF series have mixed editions rather than one uniformly current Ergates survey.
- The official DLS layer was validated locally but not selected for the public site: the DLS states that API access should be arranged with its administrator and map publication can require a licence/royalty.
- Added a third icon-filter group with three independent basemap choices: satellite, OpenTopoMap and the official Cyprus DLS Topography API. Both topographic sources retain terrain, 3D buildings, land geometry and pins; attribution and the DLS permission caveat remain visible.
- Local Chromium QA passed for OpenTopoMap and DLS at desktop and 390×844. Both sources returned HTTP 200 tiles, only the selected raster layer was visible, reset restored satellite, all 53 primary pins remained present, mobile had no horizontal overflow, and the console had zero errors or warnings.
- Asset versions were bumped. Automated validation passed: JavaScript syntax, 14/14 tests, static build and `git diff --check`.
- TODO: commit/push the dual-topographic follow-up to `main`, verify GitHub Pages deployment, then live-test both source switches.
