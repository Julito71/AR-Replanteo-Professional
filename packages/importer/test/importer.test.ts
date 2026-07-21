import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { CADMapper, DXFParser, DXFTokenizer, importDxf } from '../src/index.js';

async function fixture(name: string): Promise<string> {
  return readFile(join(process.cwd(), 'test', 'fixtures', name), 'utf8');
}

test('DXFTokenizer produces group-code tokens with source lines', async () => {
  const tokens = new DXFTokenizer().tokenize(await fixture('simple.dxf'));
  assert.deepEqual(tokens[0], { code: 0, value: 'SECTION', line: 1 });
  assert.ok(tokens.length > 0);
});

test('DXFParser builds a DXFDocument with units and model-space entities', async () => {
  const document = new DXFParser().parse(new DXFTokenizer().tokenize(await fixture('simple.dxf')));
  assert.equal(document.units, 'millimeters');
  assert.equal(document.modelSpaceEntities.length, 2);
  assert.deepEqual(document.modelSpaceEntities.map((entity) => entity.type), ['LINE', 'CIRCLE']);
});

test('CADMapper converts a DXFDocument into Project data', async () => {
  const document = new DXFParser().parse(new DXFTokenizer().tokenize(await fixture('simple.dxf')));
  const mapped = new CADMapper().map(document, { projectId: 'simple', projectName: 'Simple' });
  assert.equal(mapped.project.id, 'simple');
  assert.equal(mapped.project.name, 'Simple');
  assert.equal(mapped.project.entities.length, 2);
  assert.equal(mapped.project.entities[0]?.kind, 'line');
  assert.equal(mapped.warnings.length, 0);
});

test('importDxf returns ImporterResult statistics for simple.dxf', async () => {
  const result = importDxf(await fixture('simple.dxf'));
  assert.equal(result.statistics.numberOfEntities, 2);
  assert.equal(result.statistics.numberOfLayers, 1);
  assert.ok(result.statistics.parseTime >= 0);
  assert.equal(result.warnings.length, 0);
});

test('importDxf supports layers, colors, generated layers and arc angles', async () => {
  const result = importDxf(await fixture('layers.dxf'));
  assert.equal(result.project.layers.find((layer) => layer.id === 'Walls')?.color, 7);
  assert.equal(result.project.layers.find((layer) => layer.id === 'Hidden')?.visible, false);
  assert.ok(result.project.layers.some((layer) => layer.id === 'Generated'));
  const arc = result.project.entities.find((entity) => entity.kind === 'arc');
  assert.equal(arc?.kind, 'arc');
  if (arc?.kind === 'arc') assert.equal(arc.endAngleRadians, Math.PI / 2);
});

test('importDxf supports block definitions and basic block references', async () => {
  const result = importDxf(await fixture('blocks.dxf'));
  assert.equal(result.project.blocks.length, 1);
  assert.equal(result.project.blocks[0]?.name, 'Door');
  assert.equal(result.project.entities.length, 1);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0]?.code, 'MISSING_BLOCK');
  const line = result.project.entities[0];
  assert.equal(line?.kind, 'line');
  if (line?.kind === 'line') {
    assert.equal(line.layerId, 'Blocks');
    assert.deepEqual({ x: line.start.x, y: line.start.y }, { x: 10, y: 20 });
    assert.deepEqual({ x: line.end.x, y: line.end.y }, { x: 11, y: 20 });
  }
});

test('importDxf supports TEXT entities', async () => {
  const result = importDxf(await fixture('text.dxf'));
  const text = result.project.entities[0];
  assert.equal(text?.kind, 'text');
  if (text?.kind === 'text') {
    assert.equal(text.value, 'Hello DXF');
    assert.deepEqual({ x: text.position.x, y: text.position.y }, { x: 2, y: 3 });
  }
});

test('importDxf ignores unsupported and non-model-space entities with warnings', async () => {
  const result = importDxf(await fixture('mixed.dxf'));
  assert.equal(result.project.entities.length, 1);
  assert.equal(result.project.entities[0]?.kind, 'polyline');
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0]?.code, 'UNSUPPORTED_ENTITY');
  const polyline = result.project.entities[0];
  if (polyline?.kind === 'polyline') assert.deepEqual(polyline.points.map((point) => ({ x: point.x, y: point.y })), [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }]);
});
