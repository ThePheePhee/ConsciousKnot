import { Vector3 } from 'three';

export function spherizePoint(point: Vector3, amount: number, tipStrength: number, theta: number): Vector3 {
  const radius = point.length();
  const sphereRadius = 1.42 + 0.16 * Math.sin(10 * theta) * tipStrength + 0.05 * Math.sin(5 * theta + Math.PI / 5);
  const shell = point.clone().normalize().multiplyScalar(sphereRadius);
  const compact = point.clone().multiplyScalar(0.62 + 0.08 * Math.cos(5 * theta));
  return compact.lerp(shell, amount).multiplyScalar(1 + 0.018 * Math.sin(10 * theta + radius));
}

export function pinchWeight(theta: number, strength: number): number {
  return 0.5 + 0.5 * Math.pow(0.5 + 0.5 * Math.cos(10 * theta), 4) * strength;
}
