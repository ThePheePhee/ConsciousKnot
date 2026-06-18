import { Vector3 } from 'three';
import { knotPoint } from './knots';
import { pinchWeight, spherizePoint } from './spherize';
import type { CurveOptions, RibbonFrame } from './types';

export function sampleCurve3D(options: CurveOptions): RibbonFrame[] {
  const points: Vector3[] = [];
  for (let i = 0; i < options.samples; i++) {
    const t = (i / options.samples) * Math.PI * 2;
    let p = knotPoint(options.knot, t, options.torusP, options.torusQ);
    const outward = p.clone().normalize();
    const wave = Math.sin(options.slitherWaveCount * t + options.time * options.slitherSpeed);
    const wave2 = Math.cos((options.slitherWaveCount + 2) * t - options.time * options.slitherSpeed * 0.7);
    p.add(outward.multiplyScalar(options.slitherAmplitude * 0.16 * wave));
    p.z += options.slitherAmplitude * 0.08 * wave2;
    p = spherizePoint(p, options.spherizeAmount, options.tipStrength, t);
    points.push(p);
  }
  return buildFrames(points, options.tipStrength);
}

export function buildFrames(points: Vector3[], tipStrength: number): RibbonFrame[] {
  const n = points.length;
  const tangents = points.map((p, i) => points[(i + 1) % n].clone().sub(points[(i - 1 + n) % n]).normalize());
  const frames: RibbonFrame[] = [];
  let normal = new Vector3(0, 0, 1).cross(tangents[0]).normalize();
  if (normal.lengthSq() < 0.001) normal = new Vector3(1, 0, 0);

  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const axis = tangents[i - 1].clone().cross(tangents[i]);
      const len = axis.length();
      if (len > 0.0001) {
        axis.normalize();
        const angle = Math.atan2(len, tangents[i - 1].dot(tangents[i]));
        normal.applyAxisAngle(axis, angle);
      }
    }
    const tangent = tangents[i].clone();
    normal.sub(tangent.clone().multiplyScalar(normal.dot(tangent))).normalize();
    const binormal = tangent.clone().cross(normal).normalize();
    const outward = points[i].clone().normalize();
    const theta = (i / n) * Math.PI * 2;
    frames.push({
      position: points[i],
      tangent,
      normal,
      binormal,
      outward,
      pinch: pinchWeight(theta, tipStrength),
    });
  }
  return frames;
}
