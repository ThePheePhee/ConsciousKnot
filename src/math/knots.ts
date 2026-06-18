import { Vector3 } from 'three';
import type { KnotKind } from './types';

export function knotPoint(kind: KnotKind, theta: number, p = 5, q = 3): Vector3 {
  switch (kind) {
    case 'unknot':
      return torusPoint(theta, 1, 1, 1.5, 0.12);
    case 'trefoil':
      return torusPoint(theta, 2, 3, 1.24, 0.72);
    case 'cinquefoil':
      return torusPoint(theta, 2, 5, 1.17, 0.72);
    case 'torus34':
      return torusPoint(theta, 3, 4, 1.12, 0.77);
    case 'torus53':
      return torusPoint(theta, 5, 3, 1.08, 0.82);
    case 'torus85':
      return torusPoint(theta, 8, 5, 1.02, 0.9);
    case 'torus118':
      return torusPoint(theta, 11, 8, 0.98, 0.93);
    case 'torus137':
      return torusPoint(theta, 13, 7, 0.98, 0.94);
    case 'figureEight':
      return figureEight(theta);
    case 'customTorus':
      return torusPoint(theta, Math.max(1, Math.round(p)), Math.max(1, Math.round(q)), 1.1, 0.78);
  }
}

export function torusPoint(theta: number, p: number, q: number, major = 1.18, minor = 0.72): Vector3 {
  const x = (major + minor * Math.cos(q * theta)) * Math.cos(p * theta);
  const y = (major + minor * Math.cos(q * theta)) * Math.sin(p * theta);
  const z = minor * Math.sin(q * theta);
  return new Vector3(x, y, z);
}

function figureEight(theta: number): Vector3 {
  const x = (2 + Math.cos(2 * theta)) * Math.cos(3 * theta);
  const y = (2 + Math.cos(2 * theta)) * Math.sin(3 * theta);
  const z = Math.sin(4 * theta);
  return new Vector3(x, y, z).multiplyScalar(0.62);
}

export const knotLabels: Record<KnotKind, string> = {
  unknot: 'Unknot',
  trefoil: 'Trefoil T(2,3)',
  cinquefoil: 'Cinquefoil T(2,5)',
  torus34: 'Torus T(3,4)',
  torus53: 'Torus T(5,3)',
  torus85: 'Dense T(8,5)',
  torus118: 'Dense T(11,8)',
  torus137: 'Dense T(13,7)',
  figureEight: 'Figure-eight',
  customTorus: 'Custom torus',
};
