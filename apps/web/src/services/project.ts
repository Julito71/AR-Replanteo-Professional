import type { CadEntity, CadLayer, Project } from '@ar-replanteo/cad-engine';
import { BoundingBox2D, Vector2 } from '@ar-replanteo/geometry-engine';

export interface LayerViewModel extends CadLayer {
  readonly entityCount: number;
}

export function layersWithCounts(project: Project): readonly LayerViewModel[] {
  return project.layers.map((layer) => ({
    ...layer,
    entityCount: project.entities.filter((entity) => entity.layerId === layer.id).length,
  }));
}

export function searchLayers(layers: readonly LayerViewModel[], query: string): readonly LayerViewModel[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) return layers;
  return layers.filter((layer) => layer.name.toLowerCase().includes(normalized));
}

export function searchEntities(project: Project, query: string): readonly CadEntity[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) return project.entities;
  return project.entities.filter((entity) => {
    const text = entity.kind === 'text' ? entity.value : '';
    return entity.id.toLowerCase().includes(normalized) || text.toLowerCase().includes(normalized);
  });
}

export function projectBounds(project: Project): BoundingBox2D | null {
  const boxes = project.entities.map(entityBounds).filter((box): box is BoundingBox2D => box !== null);
  if (boxes.length === 0) return null;
  return boxes.slice(1).reduce((accumulator, box) => accumulator.union(box), boxes[0]);
}

export function entityBounds(entity: CadEntity): BoundingBox2D | null {
  switch (entity.kind) {
    case 'line': return BoundingBox2D.fromPoints([toVector(entity.start), toVector(entity.end)]);
    case 'polyline': return entity.points.length > 0 ? BoundingBox2D.fromPoints(entity.points.map(toVector)) : null;
    case 'circle': return new BoundingBox2D(new Vector2(entity.center.x - entity.radius, entity.center.y - entity.radius), new Vector2(entity.center.x + entity.radius, entity.center.y + entity.radius));
    case 'arc': return arcBounds(entity.center, entity.radius, entity.startAngleRadians, entity.endAngleRadians);
    case 'text': return new BoundingBox2D(toVector(entity.position), toVector(entity.position));
  }
}

export function entityProperties(entity: CadEntity): readonly [string, string][] {
  const bounds = entityBounds(entity);
  const base: [string, string][] = [
    ['ID', entity.id],
    ['Type', entity.kind],
    ['Layer', entity.layerId],
    ['Color', entity.color?.toString() ?? 'ByLayer'],
    ['Bounding box', bounds === null ? 'N/A' : `${formatPoint(bounds.min)} → ${formatPoint(bounds.max)}`],
  ];

  switch (entity.kind) {
    case 'line': return [...base, ['Start', formatPoint(entity.start)], ['End', formatPoint(entity.end)]];
    case 'polyline': return [...base, ['Points', entity.points.length.toString()], ['Closed', entity.closed ? 'Yes' : 'No']];
    case 'circle': return [...base, ['Center', formatPoint(entity.center)], ['Radius', entity.radius.toString()]];
    case 'arc': return [...base, ['Center', formatPoint(entity.center)], ['Radius', entity.radius.toString()], ['Start angle', entity.startAngleRadians.toFixed(3)], ['End angle', entity.endAngleRadians.toFixed(3)]];
    case 'text': return [...base, ['Position', formatPoint(entity.position)], ['Text', entity.value]];
  }
}

function arcBounds(center: { readonly x: number; readonly y: number }, radius: number, start: number, end: number): BoundingBox2D {
  const sweep = end >= start ? end - start : end - start + Math.PI * 2;
  const samples = Array.from({ length: 33 }, (_, index) => start + (sweep * index) / 32);
  return BoundingBox2D.fromPoints(samples.map((angle) => new Vector2(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius)));
}

function toVector(point: { readonly x: number; readonly y: number }): Vector2 {
  return point instanceof Vector2 ? point : new Vector2(point.x, point.y);
}

function formatPoint(point: { readonly x: number; readonly y: number }): string {
  return `(${point.x.toFixed(2)}, ${point.y.toFixed(2)})`;
}
