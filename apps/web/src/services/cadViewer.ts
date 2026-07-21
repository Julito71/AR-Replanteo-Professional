import type { CadEntity, Project } from '@ar-replanteo/cad-engine';
import { BoundingBox2D, Vector2 } from '@ar-replanteo/geometry-engine';
import { ThreeCadRenderer } from '@ar-replanteo/renderer';
import * as THREE from 'three';
import { entityBounds, projectBounds } from './project';

export interface ViewerHit {
  readonly entity: CadEntity;
  readonly distance: number;
}

export class CadViewerController {
  public readonly cadRenderer: ThreeCadRenderer;
  private readonly webglRenderer: Pick<THREE.WebGLRenderer, 'setSize' | 'render' | 'dispose'>;
  private project: Project | null = null;
  private selectedId: string | null = null;
  private readonly originalColors = new Map<string, number>();

  public constructor(private readonly canvas: HTMLCanvasElement, width: number, height: number) {
    this.cadRenderer = new ThreeCadRenderer(width, height);
    this.webglRenderer = createRenderer(canvas);
    this.webglRenderer.setSize(width, height, false);
  }

  public loadProject(project: Project): void {
    this.project = project;
    this.selectedId = null;
    this.originalColors.clear();
    this.cadRenderer.render(project.entities);
    this.fitToProject();
    this.renderFrame();
  }

  public resize(width: number, height: number): void {
    this.webglRenderer.setSize(width, height, false);
    this.cadRenderer.cameraController.resize(width, height);
    this.renderFrame();
  }

  public zoom(factor: number): void {
    this.cadRenderer.cameraController.zoom(factor);
    this.renderFrame();
  }

  public pan(screenDeltaX: number, screenDeltaY: number): void {
    const camera = this.cadRenderer.cameraController.camera;
    this.cadRenderer.cameraController.pan(new Vector2(-screenDeltaX / camera.zoom, screenDeltaY / camera.zoom));
    this.renderFrame();
  }

  public fitToProject(): void {
    if (this.project === null) return;
    const bounds = projectBounds(this.project);
    if (bounds === null) return;
    this.cadRenderer.cameraController.fitToExtents(bounds, this.canvas.clientWidth || this.canvas.width || 1, this.canvas.clientHeight || this.canvas.height || 1);
  }

  public setLayerVisible(layerId: string, visible: boolean): void {
    this.cadRenderer.layers.setLayerVisible(layerId, visible);
    this.cadRenderer.layers.apply(this.cadRenderer.sceneManager.objects());
    this.renderFrame();
  }

  public setAllLayersVisible(layerIds: readonly string[], visible: boolean): void {
    layerIds.forEach((layerId) => this.cadRenderer.layers.setLayerVisible(layerId, visible));
    this.cadRenderer.layers.apply(this.cadRenderer.sceneManager.objects());
    this.renderFrame();
  }

  public selectAt(clientX: number, clientY: number): CadEntity | null {
    if (this.project === null) return null;
    const hit = this.hitTest(clientX, clientY);
    this.selectEntity(hit?.entity.id ?? null);
    return hit?.entity ?? null;
  }

  public selectEntity(entityId: string | null): CadEntity | null {
    this.clearHighlight();
    this.selectedId = entityId;
    if (entityId !== null) this.applyHighlight(entityId);
    this.renderFrame();
    return this.project?.entities.find((entity) => entity.id === entityId) ?? null;
  }

  public dispose(): void {
    this.cadRenderer.dispose();
    this.webglRenderer.dispose();
  }

  private hitTest(clientX: number, clientY: number): ViewerHit | null {
    if (this.project === null) return null;
    const world = this.screenToWorld(clientX, clientY);
    const candidates = this.project.entities
      .filter((entity) => this.cadRenderer.layers.isLayerVisible(entity.layerId))
      .map((entity) => ({ entity, distance: distanceToEntity(world, entity) }))
      .filter((hit) => hit.distance <= 8 / this.cadRenderer.cameraController.camera.zoom)
      .sort((a, b) => a.distance - b.distance);
    return candidates[0] ?? null;
  }

  private screenToWorld(clientX: number, clientY: number): Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    const y = -(((clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1);
    const vector = new THREE.Vector3(x, y, 0).unproject(this.cadRenderer.cameraController.camera);
    return new Vector2(vector.x, vector.y);
  }

  private applyHighlight(entityId: string): void {
    const object = this.cadRenderer.sceneManager.get(entityId);
    if (object === undefined) return;
    object.traverse((child) => {
      const line = child as THREE.Object3D & { material?: THREE.LineBasicMaterial };
      if (line.material === undefined) return;
      if (!this.originalColors.has(child.uuid)) this.originalColors.set(child.uuid, line.material.color.getHex());
      line.material = line.material.clone();
      line.material.color.set(0xffcc00);
    });
  }

  private clearHighlight(): void {
    if (this.selectedId === null) return;
    const object = this.cadRenderer.sceneManager.get(this.selectedId);
    if (object === undefined) return;
    object.traverse((child) => {
      const line = child as THREE.Object3D & { material?: THREE.LineBasicMaterial };
      const color = this.originalColors.get(child.uuid);
      if (line.material !== undefined && color !== undefined) line.material.color.set(color);
    });
    this.originalColors.clear();
  }

  private renderFrame(): void {
    this.webglRenderer.render(this.cadRenderer.sceneManager.scene, this.cadRenderer.cameraController.camera);
  }
}

export function distanceToEntity(point: Vector2, entity: CadEntity): number {
  switch (entity.kind) {
    case 'line': return distanceToSegment(point, new Vector2(entity.start.x, entity.start.y), new Vector2(entity.end.x, entity.end.y));
    case 'polyline': return entity.points.length < 2 ? Number.POSITIVE_INFINITY : Math.min(...entity.points.slice(1).map((end, index) => distanceToSegment(point, new Vector2(entity.points[index].x, entity.points[index].y), new Vector2(end.x, end.y))));
    case 'circle': return Math.abs(point.distanceTo(new Vector2(entity.center.x, entity.center.y)) - entity.radius);
    case 'arc': return distanceToBounds(point, entityBounds(entity));
    case 'text': return point.distanceTo(new Vector2(entity.position.x, entity.position.y));
  }
}

function createRenderer(canvas: HTMLCanvasElement): Pick<THREE.WebGLRenderer, 'setSize' | 'render' | 'dispose'> {
  try {
    if (canvas.getContext('webgl2') === null && canvas.getContext('webgl') === null) return fallbackRenderer();
    return new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch {
    return fallbackRenderer();
  }
}

function fallbackRenderer(): Pick<THREE.WebGLRenderer, 'setSize' | 'render' | 'dispose'> {
  return { setSize: () => undefined, render: () => undefined, dispose: () => undefined };
}

function distanceToSegment(point: Vector2, start: Vector2, end: Vector2): number {
  const segment = end.subtract(start);
  const lengthSquared = segment.lengthSquared();
  if (lengthSquared === 0) return point.distanceTo(start);
  const t = Math.max(0, Math.min(1, point.subtract(start).dot(segment) / lengthSquared));
  return point.distanceTo(start.add(segment.scale(t)));
}

function distanceToBounds(point: Vector2, bounds: BoundingBox2D | null): number {
  if (bounds === null) return Number.POSITIVE_INFINITY;
  if (bounds.containsPoint(point)) return 0;
  const dx = Math.max(bounds.min.x - point.x, 0, point.x - bounds.max.x);
  const dy = Math.max(bounds.min.y - point.y, 0, point.y - bounds.max.y);
  return Math.hypot(dx, dy);
}
