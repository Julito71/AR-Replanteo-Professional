import type { CadEntity, Project } from '@ar-replanteo/cad-engine';
import type { ImporterResult } from '@ar-replanteo/importer';
import { importDxf } from '@ar-replanteo/importer';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CadViewerController } from './services/cadViewer';
import { PerformanceTracker } from './services/performance';
import { entityProperties, layersWithCounts, searchEntities, searchLayers } from './services/project';
import './styles.css';

const tracker = new PerformanceTracker();

export function App(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<CadViewerController | null>(null);
  const [result, setResult] = useState<ImporterResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [layerQuery, setLayerQuery] = useState('');
  const [entityQuery, setEntityQuery] = useState('');
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({});
  const [selectedEntity, setSelectedEntity] = useState<CadEntity | null>(null);
  const [renderTime, setRenderTime] = useState<number | null>(null);
  const [layerUpdateTime, setLayerUpdateTime] = useState<number | null>(null);

  const project = result?.project ?? null;
  const layers = useMemo(() => project === null ? [] : layersWithCounts(project), [project]);
  const filteredLayers = useMemo(() => searchLayers(layers, layerQuery), [layers, layerQuery]);
  const filteredEntities = useMemo(() => project === null ? [] : searchEntities(project, entityQuery), [project, entityQuery]);
  const selectedProperties = useMemo(() => selectedEntity === null ? [] : entityProperties(selectedEntity), [selectedEntity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null || viewerRef.current !== null) return;
    viewerRef.current = new CadViewerController(canvas, canvas.clientWidth || 800, canvas.clientHeight || 600);
    const resize = () => viewerRef.current?.resize(canvas.clientWidth || 800, canvas.clientHeight || 600);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (project === null || viewerRef.current === null) return;
    const measured = tracker.measure('initial-render', () => viewerRef.current?.loadProject(project));
    setRenderTime(measured.measurement.duration);
    setVisibleLayers(Object.fromEntries(project.layers.map((layer) => [layer.id, layer.visible])));
  }, [project]);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (file === undefined) return;
    setLoading(true);
    setSelectedEntity(null);
    try {
      const source = await readFileText(file);
      const measured = tracker.measure('dxf-import', () => importDxf(source, { projectName: file.name }));
      setResult(measured.value);
    } finally {
      setLoading(false);
    }
  }

  function setLayer(layerId: string, visible: boolean): void {
    setVisibleLayers((current) => ({ ...current, [layerId]: visible }));
    const measured = tracker.measure('layer-visibility-update', () => viewerRef.current?.setLayerVisible(layerId, visible));
    setLayerUpdateTime(measured.measurement.duration);
  }

  function setAllLayers(visible: boolean): void {
    const ids = layers.map((layer) => layer.id);
    setVisibleLayers(Object.fromEntries(ids.map((id) => [id, visible])));
    const measured = tracker.measure('layer-visibility-update', () => viewerRef.current?.setAllLayersVisible(ids, visible));
    setLayerUpdateTime(measured.measurement.duration);
  }

  function onWheel(event: React.WheelEvent<HTMLCanvasElement>): void {
    event.preventDefault();
    viewerRef.current?.zoom(event.deltaY < 0 ? 1.1 : 0.9);
  }

  const pointer = useRef<{ readonly id: number; readonly x: number; readonly y: number; readonly moved: boolean } | null>(null);
  const touches = useRef<Map<number, { readonly x: number; readonly y: number }>>(new Map());
  const pinchDistance = useRef<number | null>(null);

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId);
    touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.current.size === 1) pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    if (touches.current.size === 2) pinchDistance.current = currentPinchDistance();
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>): void {
    const previousTouch = touches.current.get(event.pointerId);
    touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.current.size === 2) {
      const nextDistance = currentPinchDistance();
      if (pinchDistance.current !== null && nextDistance !== null && nextDistance > 0) viewerRef.current?.zoom(nextDistance / pinchDistance.current);
      pinchDistance.current = nextDistance;
      return;
    }
    if (pointer.current === null || previousTouch === undefined) return;
    const dx = event.clientX - previousTouch.x;
    const dy = event.clientY - previousTouch.y;
    if (Math.abs(dx) + Math.abs(dy) > 1) {
      pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: true };
      viewerRef.current?.pan(dx, dy);
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>): void {
    const activePointer = pointer.current;
    touches.current.delete(event.pointerId);
    pinchDistance.current = touches.current.size === 2 ? currentPinchDistance() : null;
    if (activePointer !== null && activePointer.id === event.pointerId && !activePointer.moved && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      setSelectedEntity(viewerRef.current?.selectAt(event.clientX, event.clientY) ?? null);
    }
    if (touches.current.size === 0) pointer.current = null;
  }

  function currentPinchDistance(): number | null {
    const points = [...touches.current.values()];
    if (points.length !== 2) return null;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  return (
    <main className="app-shell">
      <section className="toolbar" aria-label="DXF import controls">
        <h1>CAD Viewer MVP</h1>
        <label className="file-picker">
          Open ASCII DXF
          <input aria-label="Open ASCII DXF" type="file" accept=".dxf,text/plain" onChange={(event) => void onFileChange(event)} />
        </label>
        {loading && <span role="status">Importing DXF…</span>}
        {result !== null && (
          <>
          <strong>{result.project.name}</strong>
          <dl className="metrics" aria-label="Importer warnings and statistics">
            <div><dt>Entities</dt><dd>{result.statistics.numberOfEntities}</dd></div>
            <div><dt>Layers</dt><dd>{result.statistics.numberOfLayers}</dd></div>
            <div><dt>Import time</dt><dd>{result.statistics.parseTime.toFixed(2)} ms</dd></div>
            <div><dt>Initial render</dt><dd>{renderTime?.toFixed(2) ?? '—'} ms</dd></div>
            <div><dt>Layer update</dt><dd>{layerUpdateTime?.toFixed(2) ?? '—'} ms</dd></div>
          </dl>
          </>
        )}
      </section>

      <aside className="panel layers" aria-label="Layer panel">
        <h2>Layers</h2>
        <input aria-label="Search layers" placeholder="Search layers" value={layerQuery} onChange={(event) => setLayerQuery(event.target.value)} />
        <div className="button-row">
          <button type="button" onClick={() => setAllLayers(true)}>Show all</button>
          <button type="button" onClick={() => setAllLayers(false)}>Hide all</button>
        </div>
        <ul>
          {filteredLayers.map((layer) => (
            <li key={layer.id}>
              <label>
                <input type="checkbox" checked={visibleLayers[layer.id] ?? layer.visible} onChange={(event) => setLayer(layer.id, event.target.checked)} />
                <span>{layer.name}</span>
                <small>{layer.entityCount} entities</small>
              </label>
            </li>
          ))}
        </ul>
      </aside>

      <section className="viewer" aria-label="CAD drawing viewport">
        <canvas
          ref={canvasRef}
          aria-label="CAD drawing canvas"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </section>

      <aside className="panel properties" aria-label="Entity panel">
        <h2>Entities</h2>
        <input aria-label="Search entities" placeholder="Search entity ID or text" value={entityQuery} onChange={(event) => setEntityQuery(event.target.value)} />
        <ul className="entity-results">
          {filteredEntities.slice(0, 20).map((entity) => (
            <li key={entity.id}>
              <button type="button" onClick={() => setSelectedEntity(viewerRef.current?.selectEntity(entity.id) ?? entity)}>{entity.id} · {entity.kind}</button>
            </li>
          ))}
        </ul>
        <h2>Properties</h2>
        {selectedEntity === null ? <p>No entity selected.</p> : (
          <dl className="properties-list">
            {selectedProperties.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}
          </dl>
        )}
        <h2>Import warnings</h2>
        {result?.warnings.length ? <ul>{result.warnings.map((warning, index) => <li key={`${warning.code}-${index}`}>{warning.message}</li>)}</ul> : <p>No warnings.</p>}
      </aside>
    </main>
  );
}

function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'));
    reader.readAsText(file);
  });
}
