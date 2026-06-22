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
  sevenOne71: '7_1 septafoil',
  k72: '7_2',
  k73: '7_3',
  k74: '7_4',
  k75: '7_5',
  k76: '7_6',
  k77: '7_7',
  k81: '8_1',
  k82: '8_2',
  k83: '8_3',
  k84: '8_4',
  k85: '8_5',
  k86: '8_6',
  k87: '8_7',
  k88: '8_8',
  k89: '8_9',
  k810: '8_10',
  k811: '8_11',
  k812: '8_12',
  k813: '8_13',
  k814: '8_14',
  k815: '8_15',
  k816: '8_16',
  k817: '8_17',
  k818: '8_18',
  k819: '8_19',
  k820: '8_20',
  k821: '8_21',
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
    case 'sevenOne71':
      return torus(t, 2, 7, 1.0, 0.53).multiplyScalar(0.94);
    default:
      return proceduralKnot(t, kind);
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

function proceduralKnot(t: number, key: string) {
  const { crossings, index } = parseKnotKey(key);
  if (index === 1 && crossings % 2 === 1) return torus(t, 2, crossings, 1.0, 0.52).multiplyScalar(0.94);
  const seed = crossings * 131 + index * 37;
  const f1 = 2 + (seed % 4);
  const f2 = 3 + ((seed >> 2) % 5);
  const f3 = 4 + ((seed >> 4) % 5);
  const phase = (seed % 17) * 0.37;
  const x = Math.cos(f1 * t + phase) + 0.46 * Math.cos((f2 + 1) * t - phase * 0.7) + 0.18 * Math.sin((crossings + 1) * t);
  const y = Math.sin(f2 * t - phase * 0.4) + 0.42 * Math.sin((f3 + 1) * t + phase) + 0.16 * Math.cos((index + 2) * t);
  const z = 0.72 * Math.sin(f3 * t + phase * 0.5) + 0.25 * Math.cos((f1 + f2) * t - phase);
  return new Vector3(x, y, z).multiplyScalar(0.72);
}

function parseKnotKey(key: string) {
  const compact = /^k(\d)(\d+)$/.exec(key);
  if (compact) return { crossings: Number(compact[1]), index: Number(compact[2]) };
  return { crossings: 7, index: 2 };
}
