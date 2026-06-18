import { Vector3, Vector4 } from 'three';

export function project4Dto3D(point: Vector4, distance: number): Vector3 {
  const denom = Math.max(0.18, distance - point.w);
  const factor = distance / denom;
  return new Vector3(point.x * factor, point.y * factor, point.z * factor);
}
