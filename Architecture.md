# Architecture

## Geometry Engine Independence

The project keeps mathematical geometry in `packages/geometry-engine` as a standalone TypeScript package. This package owns immutable primitives such as vectors, matrices, rays, planes, segments, bounding boxes and 2D transforms.

The geometry engine is intentionally independent from rendering because geometry operations are core domain logic, not presentation logic. CAD, calibration and future AR features all need deterministic calculations such as intersections, projections, distances, normalization, affine transformations and bounding-box queries. Keeping those calculations in a renderer-free package allows every engine to share the same numerical behavior without inheriting UI, WebGL, React or Three.js runtime constraints.

This boundary also improves testability and portability. The package compiles independently, has no React dependency, has no Three.js dependency, contains no rendering code, contains no CAD entities and performs no file import. Unit tests can therefore validate the math in isolation, and future renderers can adapt geometry results into their own scene graph or drawing API without changing the mathematical model.

## Package Responsibilities

`packages/geometry-engine` provides:

- Immutable `Vector2` and `Vector3` operations.
- `Matrix3` and `Matrix4` multiplication and affine point/vector transforms.
- `Transform2D` composition and bounding-box transformation.
- `Ray2D`, `Ray3D`, `Segment2D`, `Segment3D` and `Plane` intersection/projection helpers.
- `BoundingBox2D` and `BoundingBox3D` containment, intersection, expansion and union helpers.

Rendering layers should depend on the geometry engine, but the geometry engine must never depend on rendering layers.

## Renderer Boundary

`packages/renderer` is a standalone TypeScript package responsible only for presenting CAD entities with Three.js. It consumes geometry primitives from `packages/geometry-engine` and CAD entity contracts from `packages/cad-engine`, then adapts those inputs into Three.js scene objects.

The renderer contains no React code, no file import code and no CAD business rules. It does not decide what entities mean, how files are parsed or how CAD operations mutate a drawing. Its responsibilities are limited to camera control, scene-object lifecycle, layer visibility and entity-specific drawing adapters for lines, polylines, circles, arcs and text placeholders.

This direction keeps dependencies one-way: application and UI layers can create a renderer, CAD logic can provide entities, and geometry can provide math primitives. The renderer can be replaced or expanded without changing geometry calculations or CAD domain rules.

## Importer Boundary

`packages/importer` is a standalone strict TypeScript package for translating external ASCII DXF data into the `cad-engine` project model. It has no React, Three.js, renderer or UI dependency and exposes parsing functions that accept DXF text rather than owning file-system or browser file selection workflows. Its only allowed package dependencies are `packages/cad-engine` and `packages/geometry-engine`.

The importer follows an explicit pipeline: `DXFTokenizer` reads ASCII group codes, `DXFParser` builds a `DXFDocument`, `CADMapper` converts that document into cad-engine entities, and `importDxf` returns an `ImporterResult` containing the `Project`, collected warnings and import statistics. This keeps low-level DXF syntax separate from CAD mapping and makes unsupported-entity handling observable without throwing.

The importer is an adapter at the edge of the system. It understands DXF sections, model-space entities, layers, colors, units, block definitions and basic block references, then returns immutable `Project` data from `packages/cad-engine`. Unsupported DXF entities are skipped so imports can continue without leaking DXF-specific concerns into CAD editing or rendering code.

Keeping import logic separate means CAD business rules can operate on normalized project data, the renderer can draw cad-engine entities, and future importers can be added without changing either the geometry engine or renderer.

## CAD Viewer MVP Boundary

`apps/web` owns browser UI and user interaction only. It reads local files with the browser file picker, passes DXF text to `packages/importer`, stores the returned `Project`, warnings and statistics in UI state, and delegates drawing to `packages/renderer` through a thin viewer controller service.

CAD parsing remains in `packages/importer`, CAD object shapes remain in `packages/cad-engine`, geometric calculations such as bounds remain in `packages/geometry-engine`, and Three.js scene/entity rendering remains in `packages/renderer`. React components compose panels and event handlers, while reusable viewer behavior such as measured layer updates, hit testing, highlighting, fitting, zooming and panning lives outside components under `apps/web/src/services`.

The MVP measures DXF import time, initial render time and layer visibility update time before displaying those values. Performance claims should be based on these measurements rather than assumptions.
