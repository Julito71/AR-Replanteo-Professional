export const EPSILON = 1e-9;

export function nearlyEqual(a: number, b: number, epsilon = EPSILON): boolean {
  return Math.abs(a - b) <= epsilon;
}

function assertFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
}

export class Vector2 {
  public static readonly zero = Object.freeze(new Vector2(0, 0));

  public constructor(public readonly x: number, public readonly y: number) {
    assertFiniteNumber(x, 'x');
    assertFiniteNumber(y, 'y');
    Object.freeze(this);
  }

  public add(v: Vector2): Vector2 { return new Vector2(this.x + v.x, this.y + v.y); }
  public subtract(v: Vector2): Vector2 { return new Vector2(this.x - v.x, this.y - v.y); }
  public scale(scalar: number): Vector2 { assertFiniteNumber(scalar, 'scalar'); return new Vector2(this.x * scalar, this.y * scalar); }
  public dot(v: Vector2): number { return this.x * v.x + this.y * v.y; }
  public cross(v: Vector2): number { return this.x * v.y - this.y * v.x; }
  public lengthSquared(): number { return this.dot(this); }
  public length(): number { return Math.hypot(this.x, this.y); }
  public normalize(): Vector2 { const length = this.length(); if (length <= EPSILON) throw new Error('Cannot normalize a zero-length vector'); return this.scale(1 / length); }
  public distanceTo(v: Vector2): number { return this.subtract(v).length(); }
  public distanceSquaredTo(v: Vector2): number { return this.subtract(v).lengthSquared(); }
  public projectOnto(v: Vector2): Vector2 { const d = v.lengthSquared(); if (d <= EPSILON) throw new Error('Cannot project onto a zero-length vector'); return v.scale(this.dot(v) / d); }
  public perpendicular(): Vector2 { return new Vector2(-this.y, this.x); }
  public equals(v: Vector2, epsilon = EPSILON): boolean { return nearlyEqual(this.x, v.x, epsilon) && nearlyEqual(this.y, v.y, epsilon); }
  public toArray(): readonly [number, number] { return [this.x, this.y]; }
}

export class Vector3 {
  public static readonly zero = Object.freeze(new Vector3(0, 0, 0));

  public constructor(public readonly x: number, public readonly y: number, public readonly z: number) {
    assertFiniteNumber(x, 'x'); assertFiniteNumber(y, 'y'); assertFiniteNumber(z, 'z'); Object.freeze(this);
  }

  public add(v: Vector3): Vector3 { return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z); }
  public subtract(v: Vector3): Vector3 { return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z); }
  public scale(scalar: number): Vector3 { assertFiniteNumber(scalar, 'scalar'); return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar); }
  public dot(v: Vector3): number { return this.x * v.x + this.y * v.y + this.z * v.z; }
  public cross(v: Vector3): Vector3 { return new Vector3(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x); }
  public lengthSquared(): number { return this.dot(this); }
  public length(): number { return Math.hypot(this.x, this.y, this.z); }
  public normalize(): Vector3 { const length = this.length(); if (length <= EPSILON) throw new Error('Cannot normalize a zero-length vector'); return this.scale(1 / length); }
  public distanceTo(v: Vector3): number { return this.subtract(v).length(); }
  public distanceSquaredTo(v: Vector3): number { return this.subtract(v).lengthSquared(); }
  public projectOnto(v: Vector3): Vector3 { const d = v.lengthSquared(); if (d <= EPSILON) throw new Error('Cannot project onto a zero-length vector'); return v.scale(this.dot(v) / d); }
  public equals(v: Vector3, epsilon = EPSILON): boolean { return nearlyEqual(this.x, v.x, epsilon) && nearlyEqual(this.y, v.y, epsilon) && nearlyEqual(this.z, v.z, epsilon); }
  public toArray(): readonly [number, number, number] { return [this.x, this.y, this.z]; }
}

export class Matrix3 {
  public static readonly identity = Object.freeze(new Matrix3([1,0,0, 0,1,0, 0,0,1]));
  public readonly values: readonly number[];
  public constructor(values: readonly number[]) { if (values.length !== 9) throw new Error('Matrix3 requires 9 values'); values.forEach((v, i) => assertFiniteNumber(v, `values[${i}]`)); this.values = Object.freeze([...values]); Object.freeze(this); }
  public static translation(v: Vector2): Matrix3 { return new Matrix3([1,0,v.x, 0,1,v.y, 0,0,1]); }
  public static rotation(radians: number): Matrix3 { const c = Math.cos(radians), s = Math.sin(radians); return new Matrix3([c,-s,0, s,c,0, 0,0,1]); }
  public static scaling(x: number, y = x): Matrix3 { return new Matrix3([x,0,0, 0,y,0, 0,0,1]); }
  public multiply(m: Matrix3): Matrix3 { const a = this.values, b = m.values, r: number[] = []; for (let row=0; row<3; row++) for (let col=0; col<3; col++) r.push(a[row*3]*b[col]+a[row*3+1]*b[col+3]+a[row*3+2]*b[col+6]); return new Matrix3(r); }
  public transformPoint(v: Vector2): Vector2 { const m = this.values; const w = m[6]*v.x + m[7]*v.y + m[8]; if (Math.abs(w) <= EPSILON) throw new Error('Point transformed to infinity'); return new Vector2((m[0]*v.x + m[1]*v.y + m[2]) / w, (m[3]*v.x + m[4]*v.y + m[5]) / w); }
  public transformVector(v: Vector2): Vector2 { const m = this.values; return new Vector2(m[0]*v.x + m[1]*v.y, m[3]*v.x + m[4]*v.y); }
}

export class Matrix4 {
  public static readonly identity = Object.freeze(new Matrix4([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]));
  public readonly values: readonly number[];
  public constructor(values: readonly number[]) { if (values.length !== 16) throw new Error('Matrix4 requires 16 values'); values.forEach((v, i) => assertFiniteNumber(v, `values[${i}]`)); this.values = Object.freeze([...values]); Object.freeze(this); }
  public static translation(v: Vector3): Matrix4 { return new Matrix4([1,0,0,v.x, 0,1,0,v.y, 0,0,1,v.z, 0,0,0,1]); }
  public static scaling(x: number, y = x, z = x): Matrix4 { return new Matrix4([x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]); }
  public static rotationX(r: number): Matrix4 { const c=Math.cos(r), s=Math.sin(r); return new Matrix4([1,0,0,0, 0,c,-s,0, 0,s,c,0, 0,0,0,1]); }
  public static rotationY(r: number): Matrix4 { const c=Math.cos(r), s=Math.sin(r); return new Matrix4([c,0,s,0, 0,1,0,0, -s,0,c,0, 0,0,0,1]); }
  public static rotationZ(r: number): Matrix4 { const c=Math.cos(r), s=Math.sin(r); return new Matrix4([c,-s,0,0, s,c,0,0, 0,0,1,0, 0,0,0,1]); }
  public multiply(m: Matrix4): Matrix4 { const a=this.values,b=m.values,r:number[]=[]; for(let row=0;row<4;row++) for(let col=0;col<4;col++) r.push(a[row*4]*b[col]+a[row*4+1]*b[col+4]+a[row*4+2]*b[col+8]+a[row*4+3]*b[col+12]); return new Matrix4(r); }
  public transformPoint(v: Vector3): Vector3 { const m=this.values; const w=m[12]*v.x+m[13]*v.y+m[14]*v.z+m[15]; if(Math.abs(w)<=EPSILON) throw new Error('Point transformed to infinity'); return new Vector3((m[0]*v.x+m[1]*v.y+m[2]*v.z+m[3])/w, (m[4]*v.x+m[5]*v.y+m[6]*v.z+m[7])/w, (m[8]*v.x+m[9]*v.y+m[10]*v.z+m[11])/w); }
  public transformVector(v: Vector3): Vector3 { const m=this.values; return new Vector3(m[0]*v.x+m[1]*v.y+m[2]*v.z, m[4]*v.x+m[5]*v.y+m[6]*v.z, m[8]*v.x+m[9]*v.y+m[10]*v.z); }
}

export class Ray2D { public readonly direction: Vector2; public constructor(public readonly origin: Vector2, direction: Vector2) { this.direction = direction.normalize(); Object.freeze(this); } public at(t: number): Vector2 { return this.origin.add(this.direction.scale(t)); } public intersectSegment(segment: Segment2D): Vector2 | null { return segment.intersectRay(this); } }
export class Ray3D { public readonly direction: Vector3; public constructor(public readonly origin: Vector3, direction: Vector3) { this.direction = direction.normalize(); Object.freeze(this); } public at(t: number): Vector3 { return this.origin.add(this.direction.scale(t)); } public intersectPlane(plane: Plane): Vector3 | null { return plane.intersectRay(this); } }

export class Segment2D { public constructor(public readonly start: Vector2, public readonly end: Vector2) { Object.freeze(this); } public length(): number { return this.start.distanceTo(this.end); } public midpoint(): Vector2 { return this.start.add(this.end).scale(0.5); } public closestPoint(point: Vector2): Vector2 { const ab=this.end.subtract(this.start); const d=ab.lengthSquared(); if(d<=EPSILON) return this.start; const t=Math.max(0,Math.min(1,point.subtract(this.start).dot(ab)/d)); return this.start.add(ab.scale(t)); } public intersectRay(ray: Ray2D): Vector2 | null { const v1=ray.origin.subtract(this.start), v2=this.end.subtract(this.start), v3=new Vector2(-ray.direction.y, ray.direction.x); const denom=v2.dot(v3); if(Math.abs(denom)<=EPSILON) return null; const t1=v2.cross(v1)/denom; const t2=v1.dot(v3)/denom; return t1 >= -EPSILON && t2 >= -EPSILON && t2 <= 1+EPSILON ? ray.at(t1) : null; } public intersectSegment(other: Segment2D): Vector2 | null { const p=this.start, r=this.end.subtract(this.start), q=other.start, s=other.end.subtract(other.start); const denom=r.cross(s); if(Math.abs(denom)<=EPSILON) return null; const qp=q.subtract(p); const t=qp.cross(s)/denom, u=qp.cross(r)/denom; return t>=-EPSILON&&t<=1+EPSILON&&u>=-EPSILON&&u<=1+EPSILON ? p.add(r.scale(t)) : null; } }
export class Segment3D { public constructor(public readonly start: Vector3, public readonly end: Vector3) { Object.freeze(this); } public length(): number { return this.start.distanceTo(this.end); } public midpoint(): Vector3 { return this.start.add(this.end).scale(0.5); } public closestPoint(point: Vector3): Vector3 { const ab=this.end.subtract(this.start); const d=ab.lengthSquared(); if(d<=EPSILON) return this.start; const t=Math.max(0,Math.min(1,point.subtract(this.start).dot(ab)/d)); return this.start.add(ab.scale(t)); } }

export class Plane { public readonly normal: Vector3; public constructor(normal: Vector3, public readonly constant: number) { this.normal = normal.normalize(); assertFiniteNumber(constant, 'constant'); Object.freeze(this); } public static fromPointNormal(point: Vector3, normal: Vector3): Plane { const n=normal.normalize(); return new Plane(n, -n.dot(point)); } public signedDistanceTo(point: Vector3): number { return this.normal.dot(point) + this.constant; } public projectPoint(point: Vector3): Vector3 { return point.subtract(this.normal.scale(this.signedDistanceTo(point))); } public intersectRay(ray: Ray3D): Vector3 | null { const denom=this.normal.dot(ray.direction); if(Math.abs(denom)<=EPSILON) return null; const t=-(this.normal.dot(ray.origin)+this.constant)/denom; return t>=-EPSILON ? ray.at(t) : null; } }

export class BoundingBox2D { public constructor(public readonly min: Vector2, public readonly max: Vector2) { if(min.x>max.x || min.y>max.y) throw new Error('Invalid BoundingBox2D'); Object.freeze(this); } public static fromPoints(points: readonly Vector2[]): BoundingBox2D { if(points.length===0) throw new Error('Cannot build BoundingBox2D without points'); return new BoundingBox2D(new Vector2(Math.min(...points.map(p=>p.x)), Math.min(...points.map(p=>p.y))), new Vector2(Math.max(...points.map(p=>p.x)), Math.max(...points.map(p=>p.y)))); } public containsPoint(p: Vector2): boolean { return p.x>=this.min.x-EPSILON&&p.x<=this.max.x+EPSILON&&p.y>=this.min.y-EPSILON&&p.y<=this.max.y+EPSILON; } public intersects(b: BoundingBox2D): boolean { return this.min.x<=b.max.x&&this.max.x>=b.min.x&&this.min.y<=b.max.y&&this.max.y>=b.min.y; } public union(b: BoundingBox2D): BoundingBox2D { return BoundingBox2D.fromPoints([this.min,this.max,b.min,b.max]); } public expandByPoint(p: Vector2): BoundingBox2D { return BoundingBox2D.fromPoints([this.min,this.max,p]); } public size(): Vector2 { return this.max.subtract(this.min); } public center(): Vector2 { return this.min.add(this.max).scale(0.5); } }
export class BoundingBox3D { public constructor(public readonly min: Vector3, public readonly max: Vector3) { if(min.x>max.x || min.y>max.y || min.z>max.z) throw new Error('Invalid BoundingBox3D'); Object.freeze(this); } public static fromPoints(points: readonly Vector3[]): BoundingBox3D { if(points.length===0) throw new Error('Cannot build BoundingBox3D without points'); return new BoundingBox3D(new Vector3(Math.min(...points.map(p=>p.x)), Math.min(...points.map(p=>p.y)), Math.min(...points.map(p=>p.z))), new Vector3(Math.max(...points.map(p=>p.x)), Math.max(...points.map(p=>p.y)), Math.max(...points.map(p=>p.z)))); } public containsPoint(p: Vector3): boolean { return p.x>=this.min.x-EPSILON&&p.x<=this.max.x+EPSILON&&p.y>=this.min.y-EPSILON&&p.y<=this.max.y+EPSILON&&p.z>=this.min.z-EPSILON&&p.z<=this.max.z+EPSILON; } public intersects(b: BoundingBox3D): boolean { return this.min.x<=b.max.x&&this.max.x>=b.min.x&&this.min.y<=b.max.y&&this.max.y>=b.min.y&&this.min.z<=b.max.z&&this.max.z>=b.min.z; } public union(b: BoundingBox3D): BoundingBox3D { return BoundingBox3D.fromPoints([this.min,this.max,b.min,b.max]); } public expandByPoint(p: Vector3): BoundingBox3D { return BoundingBox3D.fromPoints([this.min,this.max,p]); } public size(): Vector3 { return this.max.subtract(this.min); } public center(): Vector3 { return this.min.add(this.max).scale(0.5); } }

export class Transform2D { public constructor(public readonly matrix: Matrix3 = Matrix3.identity) { Object.freeze(this); } public static identity(): Transform2D { return new Transform2D(); } public translate(v: Vector2): Transform2D { return new Transform2D(this.matrix.multiply(Matrix3.translation(v))); } public rotate(radians: number): Transform2D { return new Transform2D(this.matrix.multiply(Matrix3.rotation(radians))); } public scale(x: number, y = x): Transform2D { return new Transform2D(this.matrix.multiply(Matrix3.scaling(x, y))); } public combine(other: Transform2D): Transform2D { return new Transform2D(this.matrix.multiply(other.matrix)); } public applyToPoint(point: Vector2): Vector2 { return this.matrix.transformPoint(point); } public applyToVector(vector: Vector2): Vector2 { return this.matrix.transformVector(vector); } public applyToBox(box: BoundingBox2D): BoundingBox2D { const p=[box.min, new Vector2(box.max.x, box.min.y), box.max, new Vector2(box.min.x, box.max.y)].map((v) => this.applyToPoint(v)); return BoundingBox2D.fromPoints(p); } }
