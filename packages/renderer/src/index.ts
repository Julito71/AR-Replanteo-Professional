import { BoundingBox2D, Vector2 } from '@ar-replanteo/geometry-engine';
import type { ArcEntity, CadEntity, CadPoint2D, CircleEntity, LineEntity, PolylineEntity, TextEntity } from '@ar-replanteo/cad-engine';
import * as THREE from 'three';

export interface Renderer {
  readonly sceneManager: SceneManager;
  readonly cameraController: CameraController;
  readonly layers: LayerVisibilityController;
  render(entities: readonly CadEntity[]): void;
  dispose(): void;
}

export interface EntityRenderer<TEntity extends CadEntity = CadEntity> {
  readonly kind: TEntity['kind'];
  render(entity: TEntity): THREE.Object3D;
}

export class CameraController {
  public readonly camera: THREE.OrthographicCamera;

  public constructor(width: number, height: number, near = -10_000, far = 10_000) {
    this.camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, near, far);
    this.camera.position.set(0, 0, 1);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  public resize(width: number, height: number): void {
    const zoom = this.camera.zoom;
    this.camera.left = -width / 2;
    this.camera.right = width / 2;
    this.camera.top = height / 2;
    this.camera.bottom = -height / 2;
    this.camera.zoom = zoom;
    this.camera.updateProjectionMatrix();
  }

  public zoom(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) throw new Error('Zoom factor must be positive');
    this.camera.zoom *= factor;
    this.camera.updateProjectionMatrix();
  }

  public pan(delta: Vector2): void {
    this.camera.position.x += delta.x;
    this.camera.position.y += delta.y;
    this.camera.updateMatrixWorld();
  }

  public fitToExtents(bounds: BoundingBox2D, viewportWidth: number, viewportHeight: number, padding = 1.1): void {
    const size = bounds.size();
    const center = bounds.center();
    const safeWidth = Math.max(size.x * padding, 1);
    const safeHeight = Math.max(size.y * padding, 1);
    this.camera.position.set(center.x, center.y, this.camera.position.z);
    this.camera.zoom = Math.min(viewportWidth / safeWidth, viewportHeight / safeHeight);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }
}

export class LayerVisibilityController {
  private readonly visibility = new Map<string, boolean>();

  public setLayerVisible(layerId: string, visible: boolean): void {
    this.visibility.set(layerId, visible);
  }

  public showLayer(layerId: string): void { this.setLayerVisible(layerId, true); }
  public hideLayer(layerId: string): void { this.setLayerVisible(layerId, false); }
  public isLayerVisible(layerId: string): boolean { return this.visibility.get(layerId) ?? true; }

  public apply(objects: Iterable<THREE.Object3D>): void {
    for (const object of objects) {
      const layerId = object.userData.layerId as string | undefined;
      if (layerId !== undefined) object.visible = this.isLayerVisible(layerId);
    }
  }
}

export class SceneManager {
  public readonly scene = new THREE.Scene();
  private readonly entityObjects = new Map<string, THREE.Object3D>();

  public upsert(entity: CadEntity, object: THREE.Object3D): void {
    this.remove(entity.id);
    object.userData.entityId = entity.id;
    object.userData.layerId = entity.layerId;
    this.entityObjects.set(entity.id, object);
    this.scene.add(object);
  }

  public remove(entityId: string): void {
    const existing = this.entityObjects.get(entityId);
    if (existing === undefined) return;
    this.scene.remove(existing);
    disposeObject(existing);
    this.entityObjects.delete(entityId);
  }

  public clear(): void {
    for (const entityId of [...this.entityObjects.keys()]) this.remove(entityId);
  }

  public get(entityId: string): THREE.Object3D | undefined { return this.entityObjects.get(entityId); }
  public objects(): readonly THREE.Object3D[] { return [...this.entityObjects.values()]; }
}

export class ThreeCadRenderer implements Renderer {
  public readonly sceneManager = new SceneManager();
  public readonly cameraController: CameraController;
  public readonly layers = new LayerVisibilityController();
  private readonly renderers: ReadonlyMap<CadEntity['kind'], EntityRenderer>;

  public constructor(width: number, height: number, renderers: readonly EntityRenderer[] = defaultEntityRenderers()) {
    this.cameraController = new CameraController(width, height);
    this.renderers = new Map(renderers.map((renderer) => [renderer.kind, renderer]));
  }

  public render(entities: readonly CadEntity[]): void {
    this.sceneManager.clear();
    for (const entity of entities) {
      const renderer = this.renderers.get(entity.kind);
      if (renderer === undefined) throw new Error(`No renderer registered for ${entity.kind}`);
      this.sceneManager.upsert(entity, renderer.render(entity));
    }
    this.layers.apply(this.sceneManager.objects());
  }

  public dispose(): void { this.sceneManager.clear(); }
}

export class LineRenderer implements EntityRenderer<LineEntity> {
  public readonly kind = 'line' as const;
  public render(entity: LineEntity): THREE.Object3D {
    return lineObject([toVector2(entity.start), toVector2(entity.end)]);
  }
}

export class PolylineRenderer implements EntityRenderer<PolylineEntity> {
  public readonly kind = 'polyline' as const;
  public render(entity: PolylineEntity): THREE.Object3D {
    const cadPoints = entity.closed && entity.points.length > 1 ? [...entity.points, entity.points[0]] : [...entity.points];
    return lineObject(cadPoints.map(toVector2));
  }
}

export class CircleRenderer implements EntityRenderer<CircleEntity> {
  public readonly kind = 'circle' as const;
  public render(entity: CircleEntity): THREE.Object3D {
    return lineObject(sampleArc(toVector2(entity.center), entity.radius, 0, Math.PI * 2, 96));
  }
}

export class ArcRenderer implements EntityRenderer<ArcEntity> {
  public readonly kind = 'arc' as const;
  public render(entity: ArcEntity): THREE.Object3D {
    return lineObject(sampleArc(toVector2(entity.center), entity.radius, entity.startAngleRadians, entity.endAngleRadians, 48));
  }
}

export class TextPlaceholderRenderer implements EntityRenderer<TextEntity> {
  public readonly kind = 'text' as const;
  public render(entity: TextEntity): THREE.Object3D {
    const marker = 2;
    const group = new THREE.Group();
    group.add(lineObject([
      new Vector2(entity.position.x - marker, entity.position.y),
      new Vector2(entity.position.x + marker, entity.position.y),
    ]));
    group.add(lineObject([
      new Vector2(entity.position.x, entity.position.y - marker),
      new Vector2(entity.position.x, entity.position.y + marker),
    ]));
    group.userData.placeholderText = entity.value;
    return group;
  }
}

export function defaultEntityRenderers(): EntityRenderer[] {
  return [new LineRenderer(), new PolylineRenderer(), new CircleRenderer(), new ArcRenderer(), new TextPlaceholderRenderer()];
}

function lineObject(points: readonly Vector2[]): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map((point) => new THREE.Vector3(point.x, point.y, 0)));
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
}

function sampleArc(center: Vector2, radius: number, start: number, end: number, segments: number): Vector2[] {
  if (!Number.isFinite(radius) || radius <= 0) throw new Error('Radius must be positive');
  const points: Vector2[] = [];
  const sweep = end >= start ? end - start : end - start + Math.PI * 2;
  for (let index = 0; index <= segments; index += 1) {
    const angle = start + (sweep * index) / segments;
    points.push(new Vector2(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius));
  }
  return points;
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    const maybeMesh = child as THREE.Object3D & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
    maybeMesh.geometry?.dispose();
    const material = maybeMesh.material;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material?.dispose();
  });
}

function toVector2(point: CadPoint2D): Vector2 {
  return point instanceof Vector2 ? point : new Vector2(point.x, point.y);
}
