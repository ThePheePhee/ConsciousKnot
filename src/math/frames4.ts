import { Vector3, Vector4 } from 'three';
import { knotPoint } from './knots';
import { project4Dto3D } from './projection4';
import { rotate4D } from './rotations4';
import { spherizePoint } from './spherize';
import { buildFrames } from './frames3';
import type { Curve4DOptions, RibbonFrame } from './types';

export function sampleCurve4D(options: Curve4DOptions): RibbonFrame[] {
  const points3: Vector3[] = [];
  const a = smoothstep(options.transitionProgress);
  const localFocusSamples: Vector3[] = [];

  for (let i = 0; i < options.samples; i++) {
    const t = (i / options.samples) * Math.PI * 2;
    const source = sphericalKnot(options.sourceKnot, t, options);
    const target = sphericalKnot(options.targetKnot, t + 0.18 * Math.sin(Math.PI * a), options);
    const mid = sphericalKnot(options.midKnot, t + 0.12 * Math.sin(Math.PI * a + 0.7), options);
    const xyz =
      options.transitionPath === 'local crossing'
        ? localCrossingPoint(t, a, options)
        : options.transitionPath === 'three-step spherical'
          ? threeStepSpherical(source, mid, target, a)
          : sphericalBlend(source, target, a);
    const envelope = sphericalEnvelopeRadius(t, options.tipStrength);
    xyz.lerp(xyz.clone().normalize().multiplyScalar(envelope), options.sphereEnvelopeStrength);
    const liftWindow =
      options.transitionPath === 'local crossing'
        ? localWindow(t / (Math.PI * 2), options.localCrossingCenter, options.localCrossingWidth)
        : 1;
    const lift =
      options.liftAmplitude *
      liftWindow *
      Math.sin(Math.PI * a) *
      Math.sin(options.liftFrequency * t + options.time * 0.6 + 0.7 * Math.sin(5 * t));
    const p4 = rotate4D(new Vector4(xyz.x, xyz.y, xyz.z, lift), options.rotations);
    const projected = project4Dto3D(p4, options.projectionDistance4D);
    const projectedShell = projected.clone().normalize().multiplyScalar(envelope);
    projected.lerp(projectedShell, options.projectedSphereStrength);
    if (liftWindow > 0.45) localFocusSamples.push(projected.clone());
    points3.push(projected);
  }

  if (options.transitionPath === 'local crossing' && options.localFocusZoom > 0 && localFocusSamples.length > 0) {
    const focus = localFocusSamples.reduce((sum, p) => sum.add(p), new Vector3()).multiplyScalar(1 / localFocusSamples.length);
    const zoom = 1 + 1.8 * options.localFocusZoom;
    for (let i = 0; i < points3.length; i++) {
      const t01 = i / points3.length;
      const window = localWindow(t01, options.localCrossingCenter, options.localCrossingWidth * 1.8);
      const focused = focus.clone().add(points3[i].clone().sub(focus).multiplyScalar(zoom));
      points3[i].lerp(focused, window * options.localFocusZoom);
    }
  }

  return buildFrames(points3, options.tipStrength);
}

function sphericalKnot(kind: Curve4DOptions['sourceKnot'], t: number, options: Curve4DOptions): Vector3 {
  return spherizePoint(knotPoint(kind, t, options.torusP, options.torusQ), 1, options.tipStrength, t);
}

function threeStepSpherical(source: Vector3, mid: Vector3, target: Vector3, a: number): Vector3 {
  if (a < 0.5) return sphericalBlend(source, mid, smoothstep(a * 2));
  return sphericalBlend(mid, target, smoothstep((a - 0.5) * 2));
}

function sphericalBlend(a: Vector3, b: Vector3, amount: number): Vector3 {
  const radius = a.length() * (1 - amount) + b.length() * amount;
  const av = a.clone().normalize();
  const bv = b.clone().normalize();
  const dot = Math.max(-0.999, Math.min(0.999, av.dot(bv)));
  const theta = Math.acos(dot);
  if (theta < 0.001) return av.lerp(bv, amount).normalize().multiplyScalar(radius);
  const sinTheta = Math.sin(theta);
  return av
    .multiplyScalar(Math.sin((1 - amount) * theta) / sinTheta)
    .add(bv.multiplyScalar(Math.sin(amount * theta) / sinTheta))
    .normalize()
    .multiplyScalar(radius);
}

function localCrossingPoint(t: number, a: number, options: Curve4DOptions): Vector3 {
  const source = spherizePoint(knotPoint('trefoil', t, 2, 3), 1, options.tipStrength, t);
  const target = spherizePoint(knotPoint('figureEight', t + 0.1 * Math.sin(Math.PI * a), 3, 4), 1, options.tipStrength, t);
  const base = sphericalBlend(source, target, a);
  const t01 = t / (Math.PI * 2);
  const window = localWindow(t01, options.localCrossingCenter, options.localCrossingWidth);
  const tangentLike = new Vector3(-base.y, base.x, 0).normalize();
  const sideways = tangentLike.cross(base.clone().normalize()).normalize();
  const surgery = Math.sin(Math.PI * a) * window * options.localCrossingStrength;
  return base
    .add(sideways.multiplyScalar(0.42 * surgery * Math.sin(18 * t + 0.7)))
    .add(base.clone().normalize().multiplyScalar(0.18 * surgery * Math.cos(12 * t)));
}

function localWindow(t: number, center: number, width: number): number {
  const d = Math.abs((((t - center + 0.5) % 1) + 1) % 1 - 0.5);
  return Math.exp(-(d * d) / Math.max(0.0001, 2 * width * width));
}

function sphericalEnvelopeRadius(t: number, tipStrength: number): number {
  return 1.42 + 0.15 * Math.sin(10 * t) * tipStrength + 0.04 * Math.sin(5 * t + Math.PI / 5);
}

function smoothstep(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}
