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
