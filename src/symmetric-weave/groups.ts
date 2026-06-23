import { Vector3 } from 'three';
import type { ExactSymmetryGroup } from '../math/types';

export const TAU = Math.PI * 2;

export function exactGroupOrder(group: ExactSymmetryGroup) {
  if (group === 'D6') return 6;
  if (group === 'D10') return 10;
  return 8;
}

export function rotateZ(point: Vector3, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Vector3(point.x * c - point.y * s, point.x * s + point.y * c, point.z);
}

export function rotateY(point: Vector3, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Vector3(point.x * c + point.z * s, point.y, -point.x * s + point.z * c);
}

export function mirrorDihedral(point: Vector3) {
  return new Vector3(point.x, -point.y, point.z);
}

