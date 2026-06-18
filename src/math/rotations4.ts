import { Vector4 } from 'three';

type Plane = 'xy' | 'xz' | 'xw' | 'yz' | 'yw' | 'zw';

export function rotate4D(v: Vector4, rotations: Record<Plane, number>): Vector4 {
  const p = v.clone();
  rotatePlane(p, 'x', 'y', rotations.xy);
  rotatePlane(p, 'x', 'z', rotations.xz);
  rotatePlane(p, 'x', 'w', rotations.xw);
  rotatePlane(p, 'y', 'z', rotations.yz);
  rotatePlane(p, 'y', 'w', rotations.yw);
  rotatePlane(p, 'z', 'w', rotations.zw);
  return p;
}

function rotatePlane(v: Vector4, a: 'x' | 'y' | 'z' | 'w', b: 'x' | 'y' | 'z' | 'w', angle: number) {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const av = v[a];
  const bv = v[b];
  v[a] = ca * av - sa * bv;
  v[b] = sa * av + ca * bv;
}
