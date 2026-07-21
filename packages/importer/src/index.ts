import type { ArcEntity, CadBlock, CadEntity, CadLayer, CircleEntity, DrawingUnits, LineEntity, PolylineEntity, Project, TextEntity } from '@ar-replanteo/cad-engine';
import { Vector2 } from '@ar-replanteo/geometry-engine';

export interface DXFGroupCode {
  readonly code: number;
  readonly value: string;
  readonly line: number;
}

export interface DXFEntityRecord {
  readonly type: string;
  readonly pairs: readonly DXFGroupCode[];
}

export interface DXFLayerRecord {
  readonly name: string;
  readonly visible: boolean;
  readonly color?: number;
}

export interface DXFBlockRecord {
  readonly name: string;
  readonly entities: readonly DXFEntityRecord[];
}

export interface DXFDocument {
  readonly units: DrawingUnits;
  readonly layers: readonly DXFLayerRecord[];
  readonly blocks: readonly DXFBlockRecord[];
  readonly modelSpaceEntities: readonly DXFEntityRecord[];
}

export interface ImporterWarning {
  readonly code: string;
  readonly message: string;
  readonly entityType?: string;
  readonly line?: number;
}

export interface ImporterStatistics {
  readonly numberOfEntities: number;
  readonly numberOfLayers: number;
  readonly parseTime: number;
}

export interface ImporterResult {
  readonly project: Project;
  readonly warnings: readonly ImporterWarning[];
  readonly statistics: ImporterStatistics;
}

export interface DxfImportOptions {
  readonly projectId?: string;
  readonly projectName?: string;
}

type SectionMap = ReadonlyMap<string, readonly DXFGroupCode[]>;

const supportedEntities = new Set(['LINE', 'LWPOLYLINE', 'POLYLINE', 'CIRCLE', 'ARC', 'TEXT']);
const parsedEntityMarkers = new Set([...supportedEntities, 'INSERT']);

export class DXFTokenizer {
  public tokenize(source: string): readonly DXFGroupCode[] {
    const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
    const groups: DXFGroupCode[] = [];

    for (let index = 0; index < lines.length - 1; index += 2) {
      const code = Number.parseInt(lines[index].trim(), 10);
      if (!Number.isFinite(code)) continue;
      groups.push(Object.freeze({ code, value: lines[index + 1].trimEnd(), line: index + 1 }));
    }

    return Object.freeze(groups);
  }
}

export class DXFParser {
  public parse(groups: readonly DXFGroupCode[]): DXFDocument {
    const sections = this.readSections(groups);
    return Object.freeze({
      units: this.parseUnits(sections.get('HEADER') ?? []),
      layers: Object.freeze(this.parseLayers(sections.get('TABLES') ?? [])),
      blocks: Object.freeze(this.parseBlocks(sections.get('BLOCKS') ?? [])),
      modelSpaceEntities: Object.freeze(this.parseModelSpaceEntities(sections.get('ENTITIES') ?? [])),
    });
  }

  private readSections(groups: readonly DXFGroupCode[]): SectionMap {
    const sections = new Map<string, DXFGroupCode[]>();
    let currentName: string | undefined;
    let currentGroups: DXFGroupCode[] = [];

    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index];
      if (group.code === 0 && group.value.trim() === 'SECTION') {
        if (currentName !== undefined) sections.set(currentName, currentGroups);
        currentName = groups[index + 1]?.value.trim();
        currentGroups = [];
        index += 1;
        continue;
      }
      if (group.code === 0 && group.value.trim() === 'ENDSEC') {
        if (currentName !== undefined) sections.set(currentName, currentGroups);
        currentName = undefined;
        currentGroups = [];
        continue;
      }
      if (currentName !== undefined) currentGroups.push(group);
    }

    return sections;
  }

  private parseUnits(header: readonly DXFGroupCode[]): DrawingUnits {
    const index = header.findIndex((group) => group.code === 9 && group.value.trim() === '$INSUNITS');
    const value = index >= 0 ? numberValue(header[index + 1]?.value) : undefined;
    switch (value) {
      case 1: return 'inches';
      case 2: return 'feet';
      case 3: return 'miles';
      case 4: return 'millimeters';
      case 5: return 'centimeters';
      case 6: return 'meters';
      case 7: return 'kilometers';
      default: return 'unitless';
    }
  }

  private parseLayers(tables: readonly DXFGroupCode[]): DXFLayerRecord[] {
    const layers: DXFLayerRecord[] = [];
    for (let index = 0; index < tables.length; index += 1) {
      if (tables[index].code !== 0 || tables[index].value.trim() !== 'LAYER') continue;
      const pairs = collectUntilNextObject(tables, index + 1);
      const name = stringGroup(pairs, 2) ?? '0';
      const color = numberGroup(pairs, 62);
      layers.push(Object.freeze({ name, visible: color === undefined ? true : color >= 0, color: color === undefined ? undefined : Math.abs(color) }));
      index += pairs.length;
    }
    if (!layers.some((layer) => layer.name === '0')) layers.unshift(Object.freeze({ name: '0', visible: true }));
    return layers;
  }

  private parseBlocks(blockGroups: readonly DXFGroupCode[]): DXFBlockRecord[] {
    const blocks: DXFBlockRecord[] = [];
    for (let index = 0; index < blockGroups.length; index += 1) {
      if (blockGroups[index].code !== 0 || blockGroups[index].value.trim() !== 'BLOCK') continue;
      const header = collectUntilEntityOrEnd(blockGroups, index + 1, 'ENDBLK');
      const name = stringGroup(header, 2) ?? stringGroup(header, 3) ?? 'unnamed';
      const entityStart = index + 1 + header.length;
      const entityGroups = collectUntilEndBlock(blockGroups, entityStart);
      blocks.push(Object.freeze({ name, entities: Object.freeze(this.parseEntityRecords(entityGroups)) }));
      index = entityStart + entityGroups.length;
    }
    return blocks;
  }

  private parseModelSpaceEntities(groups: readonly DXFGroupCode[]): DXFEntityRecord[] {
    return this.parseEntityRecords(groups).filter((entity) => isModelSpaceEntity(entity));
  }

  private parseEntityRecords(groups: readonly DXFGroupCode[]): DXFEntityRecord[] {
    const records: DXFEntityRecord[] = [];
    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index];
      if (group.code !== 0) continue;
      const type = group.value.trim();
      if (type === 'POLYLINE') {
        const pairs: DXFGroupCode[] = [];
        for (let cursor = index + 1; cursor < groups.length; cursor += 1) {
          const cursorGroup = groups[cursor];
          if (cursorGroup.code === 0 && cursorGroup.value.trim() === 'SEQEND') {
            index = cursor;
            break;
          }
          if (cursorGroup.code === 0 && cursorGroup.value.trim() !== 'VERTEX') {
            index = cursor - 1;
            break;
          }
          pairs.push(cursorGroup);
          if (cursor === groups.length - 1) index = cursor;
        }
        records.push(Object.freeze({ type, pairs: Object.freeze(pairs) }));
        continue;
      }

      const pairs = collectUntilNextObject(groups, index + 1);
      records.push(Object.freeze({ type, pairs: Object.freeze(pairs) }));
      index += pairs.length;
    }
    return records;
  }
}

export class CADMapper {
  private readonly warnings: ImporterWarning[] = [];

  public map(document: DXFDocument, options: DxfImportOptions = {}): { readonly project: Project; readonly warnings: readonly ImporterWarning[] } {
    this.warnings.length = 0;
    const blockEntities = new Map<string, readonly CadEntity[]>();
    const blocks = document.blocks.map((block): CadBlock => {
      const entities = block.entities.flatMap((entity, index) => this.mapEntity(entity, index, block.name));
      blockEntities.set(block.name, entities);
      return Object.freeze({ name: block.name, entities: Object.freeze(entities) });
    });
    const entities = document.modelSpaceEntities.flatMap((entity, index) => this.mapModelSpaceEntity(entity, index, blockEntities));
    const layers = this.ensureEntityLayers(document.layers, [...entities, ...blocks.flatMap((block) => block.entities)]);

    return Object.freeze({
      project: Object.freeze({
        id: options.projectId ?? 'imported-dxf',
        name: options.projectName ?? 'Imported DXF',
        units: document.units,
        layers: Object.freeze(layers),
        entities: Object.freeze(entities),
        blocks: Object.freeze(blocks),
      }),
      warnings: Object.freeze([...this.warnings]),
    });
  }

  private mapModelSpaceEntity(entity: DXFEntityRecord, index: number, blocks: ReadonlyMap<string, readonly CadEntity[]>): CadEntity[] {
    if (entity.type === 'INSERT') return this.expandInsert(entity, index, blocks);
    return this.mapEntity(entity, index, 'model');
  }

  private mapEntity(entity: DXFEntityRecord, index: number, context: string): CadEntity[] {
    if (!supportedEntities.has(entity.type)) {
      if (entity.type !== 'INSERT') this.warn('UNSUPPORTED_ENTITY', `Unsupported DXF entity ignored: ${entity.type}`, entity);
      return [];
    }

    const base = { id: entityId(entity, `${context}-${index}`), layerId: stringGroup(entity.pairs, 8) ?? '0', color: normalizedColor(numberGroup(entity.pairs, 62)) };
    switch (entity.type) {
      case 'LINE': return [Object.freeze({ ...base, kind: 'line', start: point(entity.pairs, 10, 20), end: point(entity.pairs, 11, 21) } satisfies LineEntity)];
      case 'LWPOLYLINE': return [Object.freeze({ ...base, kind: 'polyline', points: Object.freeze(lightweightPolylinePoints(entity.pairs)), closed: flagGroup(entity.pairs, 70, 1) } satisfies PolylineEntity)];
      case 'POLYLINE': return [Object.freeze({ ...base, kind: 'polyline', points: Object.freeze(polylinePoints(entity.pairs)), closed: flagGroup(entity.pairs, 70, 1) } satisfies PolylineEntity)];
      case 'CIRCLE': return [Object.freeze({ ...base, kind: 'circle', center: point(entity.pairs, 10, 20), radius: numberGroup(entity.pairs, 40) ?? 0 } satisfies CircleEntity)];
      case 'ARC': return [Object.freeze({ ...base, kind: 'arc', center: point(entity.pairs, 10, 20), radius: numberGroup(entity.pairs, 40) ?? 0, startAngleRadians: degreesToRadians(numberGroup(entity.pairs, 50) ?? 0), endAngleRadians: degreesToRadians(numberGroup(entity.pairs, 51) ?? 0) } satisfies ArcEntity)];
      case 'TEXT': return [Object.freeze({ ...base, kind: 'text', position: point(entity.pairs, 10, 20), value: stringGroup(entity.pairs, 1) ?? '' } satisfies TextEntity)];
      default: return [];
    }
  }

  private expandInsert(entity: DXFEntityRecord, index: number, blocks: ReadonlyMap<string, readonly CadEntity[]>): CadEntity[] {
    const name = stringGroup(entity.pairs, 2);
    const source = name === undefined ? undefined : blocks.get(name);
    if (name === undefined || source === undefined) {
      this.warn('MISSING_BLOCK', `Block reference ignored because definition was not found: ${name ?? '<missing>'}`, entity);
      return [];
    }

    const insertion = point(entity.pairs, 10, 20);
    const layerOverride = stringGroup(entity.pairs, 8);
    return source.map((blockEntity, entityIndex) => translateEntity(blockEntity, insertion.x, insertion.y, `insert-${index}-${entityIndex}`, layerOverride));
  }

  private ensureEntityLayers(layers: readonly DXFLayerRecord[], entities: readonly CadEntity[]): CadLayer[] {
    const byId = new Map<string, CadLayer>();
    layers.forEach((layer) => byId.set(layer.name, Object.freeze({ id: layer.name, name: layer.name, visible: layer.visible, color: layer.color })));
    entities.forEach((entity) => {
      if (!byId.has(entity.layerId)) byId.set(entity.layerId, Object.freeze({ id: entity.layerId, name: entity.layerId, visible: true }));
    });
    if (!byId.has('0')) byId.set('0', Object.freeze({ id: '0', name: '0', visible: true }));
    return [...byId.values()];
  }

  private warn(code: string, message: string, entity: DXFEntityRecord): void {
    this.warnings.push(Object.freeze({ code, message, entityType: entity.type, line: entity.pairs[0]?.line }));
  }
}

export function importDxf(source: string, options: DxfImportOptions = {}): ImporterResult {
  const start = performanceNow();
  const tokenizer = new DXFTokenizer();
  const parser = new DXFParser();
  const mapper = new CADMapper();
  const document = parser.parse(tokenizer.tokenize(source));
  const mapped = mapper.map(document, options);
  const parseTime = performanceNow() - start;

  return Object.freeze({
    project: mapped.project,
    warnings: mapped.warnings,
    statistics: Object.freeze({
      numberOfEntities: mapped.project.entities.length,
      numberOfLayers: mapped.project.layers.length,
      parseTime,
    }),
  });
}

function isModelSpaceEntity(entity: DXFEntityRecord): boolean {
  const space = numberGroup(entity.pairs, 67) ?? 0;
  const layout = stringGroup(entity.pairs, 410);
  return space === 0 && (layout === undefined || layout.toLowerCase() === 'model');
}

function collectUntilNextObject(groups: readonly DXFGroupCode[], start: number): DXFGroupCode[] {
  const collected: DXFGroupCode[] = [];
  for (let index = start; index < groups.length; index += 1) {
    if (groups[index].code === 0) break;
    collected.push(groups[index]);
  }
  return collected;
}

function collectUntilEntityOrEnd(groups: readonly DXFGroupCode[], start: number, endType: string): DXFGroupCode[] {
  const collected: DXFGroupCode[] = [];
  for (let index = start; index < groups.length; index += 1) {
    if (groups[index].code === 0 && (parsedEntityMarkers.has(groups[index].value.trim()) || groups[index].value.trim() === endType)) break;
    collected.push(groups[index]);
  }
  return collected;
}

function collectUntilEndBlock(groups: readonly DXFGroupCode[], start: number): DXFGroupCode[] {
  const collected: DXFGroupCode[] = [];
  for (let index = start; index < groups.length; index += 1) {
    if (groups[index].code === 0 && groups[index].value.trim() === 'ENDBLK') break;
    collected.push(groups[index]);
  }
  return collected;
}

function lightweightPolylinePoints(groups: readonly DXFGroupCode[]): readonly Vector2[] {
  const points: Vector2[] = [];
  let pendingX: number | undefined;
  for (const group of groups) {
    if (group.code === 10) pendingX = numberValue(group.value);
    if (group.code === 20 && pendingX !== undefined) {
      points.push(new Vector2(pendingX, numberValue(group.value) ?? 0));
      pendingX = undefined;
    }
  }
  return points;
}

function polylinePoints(groups: readonly DXFGroupCode[]): readonly Vector2[] {
  const points: Vector2[] = [];
  for (let index = 0; index < groups.length; index += 1) {
    if (groups[index].code === 0 && groups[index].value.trim() === 'VERTEX') {
      const vertexGroups = collectUntilNextObject(groups, index + 1);
      points.push(point(vertexGroups, 10, 20));
      index += vertexGroups.length;
    }
  }
  return points;
}

function translateEntity(entity: CadEntity, dx: number, dy: number, idPrefix: string, layerOverride?: string): CadEntity {
  const base = { id: `${idPrefix}-${entity.id}`, layerId: layerOverride ?? entity.layerId, color: entity.color };
  switch (entity.kind) {
    case 'line': return Object.freeze({ ...base, kind: 'line', start: move(entity.start, dx, dy), end: move(entity.end, dx, dy) });
    case 'polyline': return Object.freeze({ ...base, kind: 'polyline', points: Object.freeze(entity.points.map((p) => move(p, dx, dy))), closed: entity.closed });
    case 'circle': return Object.freeze({ ...base, kind: 'circle', center: move(entity.center, dx, dy), radius: entity.radius });
    case 'arc': return Object.freeze({ ...base, kind: 'arc', center: move(entity.center, dx, dy), radius: entity.radius, startAngleRadians: entity.startAngleRadians, endAngleRadians: entity.endAngleRadians });
    case 'text': return Object.freeze({ ...base, kind: 'text', position: move(entity.position, dx, dy), value: entity.value });
  }
}

function point(groups: readonly DXFGroupCode[], xCode: number, yCode: number): Vector2 {
  return new Vector2(numberGroup(groups, xCode) ?? 0, numberGroup(groups, yCode) ?? 0);
}

function move(pointValue: { readonly x: number; readonly y: number }, dx: number, dy: number): Vector2 {
  return new Vector2(pointValue.x + dx, pointValue.y + dy);
}

function stringGroup(groups: readonly DXFGroupCode[], code: number): string | undefined {
  return groups.find((group) => group.code === code)?.value.trim();
}

function numberGroup(groups: readonly DXFGroupCode[], code: number): number | undefined {
  return numberValue(stringGroup(groups, code));
}

function flagGroup(groups: readonly DXFGroupCode[], code: number, flag: number): boolean {
  const value = numberGroup(groups, code) ?? 0;
  return (value & flag) === flag;
}

function numberValue(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizedColor(color: number | undefined): number | undefined {
  return color === undefined ? undefined : Math.abs(color);
}

function entityId(entity: DXFEntityRecord, fallback: string): string {
  return stringGroup(entity.pairs, 5) ?? `${entity.type.toLowerCase()}-${fallback}`;
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function performanceNow(): number {
  return globalThis.performance?.now() ?? Date.now();
}
