import { Vector3 } from 'three';
import type { DevShellPattern } from './types';

export const devShellPatternLabels: Record<DevShellPattern, string> = {
  'unknot shell': 'unknot shell',
  'trefoil shell': 'trefoil shell',
  'figure-eight shell': 'figure-eight shell',
  'pentafoil shell': 'pentafoil shell',
  'sixfold shell weave': 'sixfold shell weave',
  'loxodrome basket shell': 'loxodrome basket shell',
  'temari flower shell': 'temari flower shell',
  'trihex kagome shell': 'trihex kagome shell',
  'goldberg geodesic shell': 'goldberg geodesic shell',
  'phyllotactic dense shell': 'phyllotactic dense shell',
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
    case 'loxodrome basket shell':
      return loxodromeBasket(theta);
    case 'temari flower shell':
      return temariFlower(theta);
    case 'trihex kagome shell':
      return trihexKagome(theta);
    case 'goldberg geodesic shell':
      return goldbergGeodesic(theta);
    case 'phyllotactic dense shell':
      return phyllotacticDense(theta);
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
    case 'loxodrome basket shell':
      return 12;
    case 'temari flower shell':
      return 14;
    case 'trihex kagome shell':
      return 18;
    case 'goldberg geodesic shell':
      return 20;
    case 'phyllotactic dense shell':
      return 28;
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

function loxodromeBasket(theta: number) {
  const azimuth = 9 * theta + 0.22 * Math.sin(18 * theta) + 0.08 * Math.sin(27 * theta + 0.5);
  const z = clamp(0.82 * Math.sin(5 * theta + 0.18 * Math.sin(15 * theta)), -0.9, 0.9);
  const radius = 1.34 + 0.28 * Math.sin(20 * theta + 0.4) + 0.08 * Math.cos(10 * theta);
  return sphericalPoint(azimuth, z, radius);
}

function temariFlower(theta: number) {
  const azimuth = 4 * theta + 0.42 * Math.sin(8 * theta) + 0.16 * Math.sin(16 * theta + 0.2);
  const z = clamp(0.86 * Math.sin(6 * theta + 0.24 * Math.sin(12 * theta)), -0.92, 0.92);
  const petals = Math.pow(0.5 + 0.5 * Math.cos(12 * theta), 1.8);
  const radius = 1.28 + 0.18 * Math.cos(12 * theta) + 0.16 * petals + 0.05 * Math.sin(24 * theta);
  return sphericalPoint(azimuth, z, radius);
}

function trihexKagome(theta: number) {
  const carrier = new Vector3(
    Math.cos(5 * theta) + 0.52 * Math.cos(11 * theta + 0.4) + 0.24 * Math.cos(17 * theta),
    Math.sin(5 * theta) - 0.48 * Math.sin(11 * theta + 0.4) + 0.22 * Math.sin(17 * theta),
    0.78 * Math.sin(6 * theta) + 0.28 * Math.sin(12 * theta + 0.7),
  ).normalize();
  const radius = 1.33 + 0.24 * Math.sin(18 * theta) + 0.10 * Math.cos(30 * theta + 0.2);
  return carrier.multiplyScalar(radius);
}

function goldbergGeodesic(theta: number) {
  const carrier = new Vector3(
    Math.cos(6 * theta) + 0.45 * Math.cos(16 * theta + 0.35),
    Math.sin(6 * theta) + 0.45 * Math.sin(14 * theta - 0.2),
    0.72 * Math.sin(10 * theta) + 0.24 * Math.cos(20 * theta + 0.5),
  ).normalize();
  const radius = 1.32 + 0.20 * Math.cos(20 * theta) + 0.12 * Math.cos(32 * theta + 0.4);
  return carrier.multiplyScalar(radius);
}

function phyllotacticDense(theta: number) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const turn = theta / (Math.PI * 2);
  const azimuth = 34 * golden * turn + 0.18 * Math.sin(13 * theta);
  const z = clamp(Math.sin(11 * theta + 0.3 * Math.sin(21 * theta)) * 0.88, -0.91, 0.91);
  const radius = 1.3 + 0.18 * Math.sin(34 * theta) + 0.13 * Math.cos(55 * theta + 0.2);
  return sphericalPoint(azimuth, z, radius);
}

function sphericalPoint(azimuth: number, z: number, radius: number) {
  const xy = Math.sqrt(Math.max(0.001, 1 - z * z));
  return new Vector3(Math.cos(azimuth) * xy, Math.sin(azimuth) * xy, z).multiplyScalar(radius);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
