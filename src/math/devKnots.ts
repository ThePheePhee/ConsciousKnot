import { Vector3 } from 'three';
import type { DevKnotKind } from './types';

export const devKnotLabels: Record<DevKnotKind, string> = {
  unknot: '0_1 unknot',
  trefoil31: '3_1 trefoil',
  figureEight41: '4_1 figure-eight',
  cinquefoil51: '5_1 cinquefoil',
  twist52: '5_2 twist knot',
  stevedore61: '6_1 stevedore',
  sixTwo62: '6_2',
  sixThree63: '6_3',
};

export function devKnotPoint(kind: DevKnotKind, t: number): Vector3 {
  switch (kind) {
    case 'unknot':
      return new Vector3(1.45 * Math.cos(t), 1.45 * Math.sin(t), 0);
    case 'trefoil31':
      return new Vector3(Math.sin(t) + 2 * Math.sin(2 * t), Math.cos(t) - 2 * Math.cos(2 * t), -Math.sin(3 * t)).multiplyScalar(0.42);
    case 'figureEight41':
      return new Vector3((2 + Math.cos(2 * t)) * Math.cos(3 * t), (2 + Math.cos(2 * t)) * Math.sin(3 * t), Math.sin(4 * t)).multiplyScalar(0.52);
    case 'cinquefoil51':
      return torus(t, 2, 5, 1.05, 0.56).multiplyScalar(0.92);
    case 'twist52':
      return fourier(t, [
        [1.0, 2, 0.25, 5],
        [0.75, 3, -0.28, 1],
        [0.62, 4, 0.2, 7],
      ]);
    case 'stevedore61':
      return fourier(t, [
        [1.0, 2, 0.38, 6],
        [0.78, 3, 0.18, 5],
        [0.72, 4, -0.26, 2],
      ]);
    case 'sixTwo62':
      return fourier(t, [
        [0.98, 3, 0.34, 5],
        [0.82, 2, -0.22, 7],
        [0.68, 5, 0.2, 1],
      ]);
    case 'sixThree63':
      return fourier(t, [
        [0.95, 3, -0.28, 4],
        [0.85, 4, 0.24, 7],
        [0.62, 5, -0.2, 2],
      ]);
  }
}

function torus(t: number, p: number, q: number, major: number, minor: number) {
  return new Vector3((major + minor * Math.cos(q * t)) * Math.cos(p * t), (major + minor * Math.cos(q * t)) * Math.sin(p * t), minor * Math.sin(q * t));
}

function fourier(t: number, rows: [number, number, number, number][]) {
  const [x, y, z] = rows.map(([a, f, b, g], axis) => {
    const phase = axis * 0.7;
    return a * Math.cos(f * t + phase) + b * Math.sin(g * t - phase);
  });
  return new Vector3(x, y, z).multiplyScalar(0.86);
}
