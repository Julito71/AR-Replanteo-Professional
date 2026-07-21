import assert from 'node:assert/strict';
import test from 'node:test';
import { BoundingBox2D, Vector2 } from '@ar-replanteo/geometry-engine';
import type { CadEntity } from '@ar-replanteo/cad-engine';
import { ArcRenderer, CameraController, CircleRenderer, LayerVisibilityController, LineRenderer, PolylineRenderer, TextPlaceholderRenderer, ThreeCadRenderer } from '../src/index.js';

const entities: CadEntity[] = [
  { id: 'line-1', kind: 'line', layerId: 'a', start: new Vector2(0, 0), end: new Vector2(10, 0) },
  { id: 'poly-1', kind: 'polyline', layerId: 'b', points: [new Vector2(0, 0), new Vector2(0, 5)], closed: false },
  { id: 'circle-1', kind: 'circle', layerId: 'a', center: new Vector2(5, 5), radius: 2 },
  { id: 'arc-1', kind: 'arc', layerId: 'a', center: new Vector2(1, 1), radius: 3, startAngleRadians: 0, endAngleRadians: Math.PI },
  { id: 'text-1', kind: 'text', layerId: 'labels', position: new Vector2(2, 2), value: 'placeholder' },
];

test('ThreeCadRenderer renders supported CAD entities into a scene', () => {
  const renderer = new ThreeCadRenderer(800, 600);
  renderer.render(entities);
  assert.equal(renderer.sceneManager.objects().length, entities.length);
  assert.ok(renderer.sceneManager.get('line-1'));
  assert.equal(renderer.sceneManager.scene.children.length, entities.length);
  renderer.dispose();
  assert.equal(renderer.sceneManager.objects().length, 0);
});

test('LayerVisibilityController show/hide state is applied to scene objects', () => {
  const renderer = new ThreeCadRenderer(800, 600);
  renderer.layers.hideLayer('a');
  renderer.render(entities);
  assert.equal(renderer.sceneManager.get('line-1')?.visible, false);
  assert.equal(renderer.sceneManager.get('poly-1')?.visible, true);
  renderer.layers.showLayer('a');
  renderer.layers.apply(renderer.sceneManager.objects());
  assert.equal(renderer.sceneManager.get('circle-1')?.visible, true);
});

test('CameraController supports zoom, pan, resize and fit to extents', () => {
  const camera = new CameraController(100, 50);
  camera.zoom(2);
  assert.equal(camera.camera.zoom, 2);
  camera.pan(new Vector2(10, -5));
  assert.equal(camera.camera.position.x, 10);
  assert.equal(camera.camera.position.y, -5);
  camera.resize(200, 100);
  assert.equal(camera.camera.right, 100);
  camera.fitToExtents(new BoundingBox2D(new Vector2(0, 0), new Vector2(20, 10)), 200, 100, 1);
  assert.equal(camera.camera.position.x, 10);
  assert.equal(camera.camera.position.y, 5);
  assert.equal(camera.camera.zoom, 10);
});

test('Entity renderers create Three.js objects without DOM or React', () => {
  assert.ok(new LineRenderer().render(entities[0] as Extract<CadEntity, { kind: 'line' }>));
  assert.ok(new PolylineRenderer().render(entities[1] as Extract<CadEntity, { kind: 'polyline' }>));
  assert.ok(new CircleRenderer().render(entities[2] as Extract<CadEntity, { kind: 'circle' }>));
  assert.ok(new ArcRenderer().render(entities[3] as Extract<CadEntity, { kind: 'arc' }>));
  assert.ok(new TextPlaceholderRenderer().render(entities[4] as Extract<CadEntity, { kind: 'text' }>));
});

test('LayerVisibilityController defaults unknown layers to visible', () => {
  const layers = new LayerVisibilityController();
  assert.equal(layers.isLayerVisible('unknown'), true);
  layers.hideLayer('unknown');
  assert.equal(layers.isLayerVisible('unknown'), false);
});
