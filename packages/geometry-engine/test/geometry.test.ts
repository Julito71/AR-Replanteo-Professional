import assert from 'node:assert/strict';
import test from 'node:test';
import { BoundingBox2D, BoundingBox3D, Matrix3, Matrix4, Plane, Ray2D, Ray3D, Segment2D, Segment3D, Transform2D, Vector2, Vector3 } from '../src/index.js';

test('Vector2 operations are immutable and correct', () => {
  const a = new Vector2(3, 4);
  assert.equal(a.length(), 5);
  assert.deepEqual(a.add(new Vector2(1, 2)).toArray(), [4, 6]);
  assert.deepEqual(a.toArray(), [3, 4]);
  assert.equal(a.dot(new Vector2(2, 0)), 6);
  assert.equal(a.cross(new Vector2(0, 2)), 6);
  assert.ok(a.normalize().equals(new Vector2(0.6, 0.8)));
  assert.ok(new Vector2(2, 2).projectOnto(new Vector2(1, 0)).equals(new Vector2(2, 0)));
});

test('Vector3 supports dot, cross, distance and projection', () => {
  const x = new Vector3(1, 0, 0);
  const y = new Vector3(0, 1, 0);
  assert.ok(x.cross(y).equals(new Vector3(0, 0, 1)));
  assert.equal(x.dot(y), 0);
  assert.equal(new Vector3(1, 2, 2).length(), 3);
  assert.equal(new Vector3(1, 1, 1).distanceTo(new Vector3(1, 1, 4)), 3);
  assert.ok(new Vector3(2, 2, 0).projectOnto(new Vector3(0, 1, 0)).equals(new Vector3(0, 2, 0)));
});

test('Matrix3 and Transform2D apply affine transformations', () => {
  const matrix = Matrix3.translation(new Vector2(10, 0)).multiply(Matrix3.scaling(2));
  assert.ok(matrix.transformPoint(new Vector2(2, 3)).equals(new Vector2(14, 6)));
  const transform = Transform2D.identity().translate(new Vector2(5, 5)).rotate(Math.PI / 2);
  assert.ok(transform.applyToPoint(new Vector2(1, 0)).equals(new Vector2(5, 6)));
});

test('Matrix4 applies 3D affine transformations', () => {
  const matrix = Matrix4.translation(new Vector3(1, 2, 3)).multiply(Matrix4.scaling(2));
  assert.ok(matrix.transformPoint(new Vector3(1, 1, 1)).equals(new Vector3(3, 4, 5)));
  assert.ok(Matrix4.rotationZ(Math.PI / 2).transformVector(new Vector3(1, 0, 0)).equals(new Vector3(0, 1, 0)));
});

test('Segments and rays compute closest points and intersections', () => {
  const segment = new Segment2D(new Vector2(0, 0), new Vector2(10, 0));
  assert.equal(segment.length(), 10);
  assert.ok(segment.closestPoint(new Vector2(4, 5)).equals(new Vector2(4, 0)));
  assert.ok(segment.intersectSegment(new Segment2D(new Vector2(5, -1), new Vector2(5, 1)))?.equals(new Vector2(5, 0)));
  assert.ok(new Ray2D(new Vector2(5, -5), new Vector2(0, 1)).intersectSegment(segment)?.equals(new Vector2(5, 0)));
  assert.ok(new Segment3D(new Vector3(0, 0, 0), new Vector3(0, 0, 4)).midpoint().equals(new Vector3(0, 0, 2)));
});

test('Planes project points and intersect rays', () => {
  const plane = Plane.fromPointNormal(new Vector3(0, 0, 2), new Vector3(0, 0, 1));
  assert.equal(plane.signedDistanceTo(new Vector3(0, 0, 5)), 3);
  assert.ok(plane.projectPoint(new Vector3(1, 1, 5)).equals(new Vector3(1, 1, 2)));
  assert.ok(new Ray3D(new Vector3(0, 0, 0), new Vector3(0, 0, 1)).intersectPlane(plane)?.equals(new Vector3(0, 0, 2)));
});

test('Bounding boxes compute containment, union and transformed bounds', () => {
  const box = BoundingBox2D.fromPoints([new Vector2(0, 0), new Vector2(2, 3)]);
  assert.ok(box.containsPoint(new Vector2(1, 2)));
  assert.ok(box.union(new BoundingBox2D(new Vector2(-1, -1), new Vector2(0, 0))).containsPoint(new Vector2(-1, -1)));
  assert.ok(Transform2D.identity().translate(new Vector2(1, 1)).applyToBox(box).containsPoint(new Vector2(3, 4)));

  const box3 = BoundingBox3D.fromPoints([new Vector3(0, 0, 0), new Vector3(1, 2, 3)]);
  assert.ok(box3.containsPoint(new Vector3(1, 2, 3)));
  assert.ok(box3.intersects(new BoundingBox3D(new Vector3(1, 2, 3), new Vector3(2, 3, 4))));
});
