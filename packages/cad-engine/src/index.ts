export type CadEntityKind = 'line' | 'polyline' | 'circle' | 'arc' | 'text';

export interface CadPoint2D {
  readonly x: number;
  readonly y: number;
}

export interface CadBounds2D {
  readonly min: CadPoint2D;
  readonly max: CadPoint2D;
}

export interface CadEntityBase {
  readonly id: string;
  readonly kind: CadEntityKind;
  readonly layerId: string;
  readonly color?: number;
  readonly bounds?: CadBounds2D;
}

export interface LineEntity extends CadEntityBase {
  readonly kind: 'line';
  readonly start: CadPoint2D;
  readonly end: CadPoint2D;
}

export interface PolylineEntity extends CadEntityBase {
  readonly kind: 'polyline';
  readonly points: readonly CadPoint2D[];
  readonly closed?: boolean;
}

export interface CircleEntity extends CadEntityBase {
  readonly kind: 'circle';
  readonly center: CadPoint2D;
  readonly radius: number;
}

export interface ArcEntity extends CadEntityBase {
  readonly kind: 'arc';
  readonly center: CadPoint2D;
  readonly radius: number;
  readonly startAngleRadians: number;
  readonly endAngleRadians: number;
}

export interface TextEntity extends CadEntityBase {
  readonly kind: 'text';
  readonly position: CadPoint2D;
  readonly value: string;
}

export type CadEntity = LineEntity | PolylineEntity | CircleEntity | ArcEntity | TextEntity;

export interface CadLayer {
  readonly id: string;
  readonly name: string;
  readonly visible: boolean;
  readonly color?: number;
}

export type DrawingUnits = 'unitless' | 'inches' | 'feet' | 'miles' | 'millimeters' | 'centimeters' | 'meters' | 'kilometers';

export interface CadBlock {
  readonly name: string;
  readonly entities: readonly CadEntity[];
}

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly units: DrawingUnits;
  readonly layers: readonly CadLayer[];
  readonly entities: readonly CadEntity[];
  readonly blocks: readonly CadBlock[];
}
