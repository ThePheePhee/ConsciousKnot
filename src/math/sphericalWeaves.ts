import { Vector3 } from 'three';
import type { DevShellPattern } from './types';

export const devShellPatternLabels: Record<DevShellPattern, string> = {
  'unknot shell': 'unknot shell',
  'trefoil shell': 'trefoil shell',
  'figure-eight shell': 'figure-eight shell',
  'pentafoil shell': 'pentafoil shell',
  'sixfold shell weave': 'sixfold shell weave',
};

export function shellPatternPoint(pattern: DevShellPattern, theta: number) {
  switch (pattern) {
    case 'unknot shell':
      return new Vector3(Math.cos(theta), Math.sin(theta), 0).multiplyScalar(1.35);
    case 'trefoil shell':
      return torusPoint(theta, 2, 3, 1.12, 0.58);
    case 'figure-eight shell':
      return figureEight(theta).multiplyScalar(0.68);
    case 'pentafoil shell':
      return torusPoint(theta, 2, 5, 1.08, 0.56);
    case 'sixfold shell weave':
      return denseShellWeave(theta);
  }
}

export function shellPatternCrossings(pattern: DevShellPattern) {
  switch (pattern) {
    case 'unknot shell':
      return 0;
    case 'trefoil shell':
      return 3;
    case 'figure-eight shell':
      return 4;
    case 'pentafoil shell':
      return 5;
    case 'sixfold shell weave':
      return 8;
  }
}

function torusPoint(theta: number, p: number, q: number, major: number, minor: number) {
  const x = (major + minor * Math.cos(q * theta)) * Math.cos(p * theta);
  const y = (major + minor * Math.cos(q * theta)) * Math.sin(p * theta);
  const z = minor * Math.sin(q * theta);
  return new Vector3(x, y, z);
}

function figureEight(theta: number) {
  const x = (2 + Math.cos(2 * theta)) * Math.cos(3 * theta);
  const y = (2 + Math.cos(2 * theta)) * Math.sin(3 * theta);
  const z = Math.sin(4 * theta);
  return new Vector3(x, y, z);
}

function denseShellWeave(theta: number) {
  const azimuth = 5 * theta + 0.34 * Math.sin(6 * theta) + 0.1 * Math.sin(12 * theta + 0.4);
  const z = Math.max(-0.86, Math.min(0.86, 0.68 * Math.sin(6 * theta) + 0.18 * Math.sin(10 * theta + 0.7)));
  const xy = Math.sqrt(Math.max(0.001, 1 - z * z));
  const radius = 1.32 + 0.26 * Math.cos(6 * theta + 0.4) + 0.08 * Math.sin(11 * theta);
  return new Vector3(Math.cos(azimuth) * xy, Math.sin(azimuth) * xy, z).multiplyScalar(radius);
}
