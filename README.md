# AR-Replanteo-Professional

A modular CAD viewer/import pipeline for AR replanteo workflows.

## Packages and apps

- `packages/geometry-engine`: immutable geometry primitives and calculations.
- `packages/cad-engine`: CAD domain contracts, layers, blocks and projects.
- `packages/importer`: standalone ASCII DXF importer returning `ImporterResult`.
- `packages/renderer`: Three.js renderer for CAD entities without React/UI coupling.
- `apps/web`: browser CAD Viewer MVP that opens local DXF files, imports them offline, renders the project and exposes layers, search, selection, properties, warnings and measured performance timings.

## CAD Viewer MVP acceptance checklist

- [x] Open an ASCII DXF from the browser file picker.
- [x] Import DXF text through `packages/importer` with no backend.
- [x] Display the resulting `Project` through `packages/renderer`.
- [x] Fit the complete drawing to the viewport after import.
- [x] Mouse wheel zoom.
- [x] Mouse drag pan.
- [x] Touch pinch zoom.
- [x] One-finger touch pan.
- [x] Click/tap entity selection.
- [x] Highlight selected entity.
- [x] Layer panel with imported layers.
- [x] Toggle individual layer visibility.
- [x] Turn all layers on/off.
- [x] Search layers by name.
- [x] Display entity count per layer.
- [x] Search entities by stable ID and text content.
- [x] Properties panel for selected entity.
- [x] Display importer warnings and statistics.
- [x] Loading/progress state while importing.
- [x] Performance measurements for DXF import, initial render and layer visibility updates.

## Development

Install dependencies and run all package/app builds and tests:

```bash
npm install
npm run build
npm test
```

Run the web app locally:

```bash
npm run dev --prefix apps/web
```

Run the Playwright E2E test when browser binaries are installed:

```bash
npm run test:e2e --prefix apps/web
```

> Note: Playwright browser binaries are not committed. If `npm run test:e2e --prefix apps/web` reports a missing Chromium executable, install browsers with `npx playwright install` and rerun the command. Unit and integration tests do not require Playwright browsers.
