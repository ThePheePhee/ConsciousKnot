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
  const sourceToMidPhase = alignedPhase(options.sourceKnot, options.midKnot, options);
  const sourceToTargetPhase = alignedPhase(options.sourceKnot, options.targetKnot, options);
  const midToTargetPhase = alignedPhase(options.midKnot, options.targetKnot, options);

  for (let i = 0; i < options.samples; i++) {
    const t = (i / options.samples) * Math.PI * 2;
    const source = sphericalKnot(options.sourceKnot, t, options);
    const target = sphericalKnot(options.targetKnot, t + sourceToTargetPhase, options);
    const mid = sphericalKnot(options.midKnot, t + sourceToMidPhase, options);
    const targetFromMid = sphericalKnot(options.targetKnot, t + sourceToMidPhase + midToTargetPhase, options);
    const xyz =
      options.transitionPath === 'local crossing'
        ? localCrossingPoint(t, a, options)
        : options.transitionPath === 'three-step spherical'
          ? threeStepSpherical(source, mid, targetFromMid, a)
          : sphericalBlend(source, target, a);
    const envelope = sphericalEnvelopeRadius(t, options.tipStrength, options.symmetryOrder);
    xyz.lerp(xyz.clone().normalize().multiplyScalar(envelope), options.sphereTightness);
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
    projected.lerp(projectedShell, Math.pow(options.sphereTightness, 1.35));
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

  recenterAndReshell(points3, options);

  return buildFrames(points3, options.tipStrength);
}

function sphericalKnot(kind: Curve4DOptions['sourceKnot'], t: number, options: Curve4DOptions): Vector3 {
  const p = spherizePoint(knotPoint(kind, t, options.torusP, options.torusQ), 1, options.tipStrength, t);
  return p.normalize().multiplyScalar(sphericalEnvelopeRadius(t, options.tipStrength, options.symmetryOrder));
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
  if (dot < -0.96) {
    const axis = stableAxis(av);
    return av.applyAxisAngle(axis, Math.PI * amount).normalize().multiplyScalar(radius);
  }
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

function sphericalEnvelopeRadius(t: number, tipStrength: number, symmetryOrder: number): number {
  const order = Math.max(3, Math.round(symmetryOrder));
  return 1.42 + 0.13 * Math.sin(2 * order * t) * tipStrength + 0.035 * Math.sin(order * t + Math.PI / order);
}

function smoothstep(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

function alignedPhase(sourceKind: Curve4DOptions['sourceKnot'], targetKind: Curve4DOptions['targetKnot'], options: Curve4DOptions): number {
  if (options.phaseLockStrength <= 0) return 0;
  const steps = Math.max(8, Math.round(options.phaseSearchSteps));
  const probes = 72;
  const symmetry = Math.max(3, Math.round(options.symmetryOrder));
  let bestPhase = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let s = 0; s < steps; s++) {
    const phase = (s / steps) * Math.PI * 2;
    let score = 0;
    for (let i = 0; i < probes; i++) {
      const t = (i / probes) * Math.PI * 2;
      const a = spherizePoint(knotPoint(sourceKind, t, options.torusP, options.torusQ), 1, options.tipStrength, t).normalize();
      const b = spherizePoint(knotPoint(targetKind, t + phase, options.torusP, options.torusQ), 1, options.tipStrength, t + phase).normalize();
      const symmetryBias = 0.035 * (1 - Math.cos(symmetry * phase));
      score += 1 - a.dot(b) + symmetryBias;
    }
    if (score < bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }

  return bestPhase * options.phaseLockStrength;
}

function stableAxis(v: Vector3): Vector3 {
  const candidate = Math.abs(v.z) < 0.8 ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0);
  return candidate.cross(v).normalize();
}

function recenterAndReshell(points: Vector3[], options: Curve4DOptions) {
  const centroid = points.reduce((sum, p) => sum.add(p), new Vector3()).multiplyScalar(1 / points.length);
  const pull = 0.82 * options.sphereTightness;
  for (let i = 0; i < points.length; i++) {
    const t = (i / points.length) * Math.PI * 2;
    const envelope = sphericalEnvelopeRadius(t, options.tipStrength, options.symmetryOrder);
    points[i].sub(centroid.clone().multiplyScalar(pull));
    points[i].lerp(points[i].clone().normalize().multiplyScalar(envelope), options.sphereTightness);
  }
}
