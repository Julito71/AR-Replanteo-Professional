# Roadmap

## Epic 1 — CAD Viewer MVP

### Completed in Sprint 5

- Browser-only ASCII DXF file opening.
- DXF import through the standalone importer package.
- Project rendering through the renderer package.
- Fit-to-viewport after import.
- Desktop mouse wheel zoom, mouse drag pan and click selection.
- Touch/mobile one-finger pan, tap selection and pinch zoom.
- Layer panel with search, entity counts, individual toggles and show/hide all controls.
- Entity search by stable ID and text content.
- Entity selection highlighting and properties panel.
- Import warnings and importer/render/layer timing display.
- Unit/integration tests for loading, layer visibility, search, selection, properties, warnings and practical mobile pointer behavior.
- Playwright E2E spec for opening a DXF, rendering, toggling a layer and selecting an entity.

### Next

- Expand renderer hit testing with spatial acceleration for very large drawings.
- Add richer text rendering once font strategy is defined.
- Support additional DXF entities after CAD domain requirements are prioritized.
- Add persisted viewer preferences for layer visibility and camera position.

### Test environment note

The E2E spec is committed under `apps/web/e2e`. In environments where Playwright browser binaries are not installed, `npm run test:e2e --prefix apps/web` reports the missing Chromium executable and the unit/integration suite remains the required fallback until browsers are installed with `npx playwright install`.
