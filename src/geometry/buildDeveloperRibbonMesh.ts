import { BufferAttribute, BufferGeometry, Vector3, Vector4 } from 'three';
import { devKnotPoint } from '../math/devKnots';
import { project4Dto3D } from '../math/projection4';
import { buildFrames } from '../math/frames3';
import type { DevCrossingMode, DevKnotKind } from '../math/types';

interface DeveloperRibbonOptions {
  knots: DevKnotKind[];
  progress: number;
  samples: number;
  width: number;
  crossSamples: number;
  liftAmplitude: number;
  projectionDistance4D: number;
  canonicalRelaxation: number;
  intermediateRelaxation: number;
  simultaneousUncrossings: number;
  crossingMode: DevCrossingMode;
  hideDuringUncrossing: number;
  fourthDimensionDuty: number;
  twistTurns: number;
}

interface CrossingField {
  signedLift: number;
  window: number;
}

const phaseCache = new Map<string, number>();

export function buildDeveloperRibbonMesh(options: DeveloperRibbonOptions) {
  const knots = options.knots.length > 0 ? options.knots : ['unknot' as DevKnotKind];
  const segmentCount = Math.max(1, knots.length - 1);
  const segmentPosition = Math.min(0.999999, Math.max(0, options.progress)) * segmentCount;
  const segmentIndex = Math.min(segmentCount - 1, Math.floor(segmentPosition));
  const segmentT = segmentCount === 1 && knots.length === 1 ? 0 : segmentPosition - segmentIndex;
  const sourceKnot = knots[segmentIndex] ?? knots[0];
  const targetKnot = knots[Math.min(segmentIndex + 1, knots.length - 1)] ?? sourceKnot;
  const changesKnotType = sourceKnot !== targetKnot;
  const targetPhase = alignedPhase(sourceKnot, targetKnot, options.samples);
  const stage = stagedProgress(segmentT, segmentIndex, options);
  const basePoints: Vector3[] = [];
  for (let i = 0; i < options.samples; i++) {
    const t = (i / options.samples) * Math.PI * 2;
    const source = devKnotPoint(sourceKnot, t);
    const target = devKnotPoint(targetKnot, t + targetPhase);
    basePoints.push(source.clone().lerp(target, smootherstep(stage.morph)));
  }
  const crossingField =
    options.crossingMode === 'hidden 4D passage' && changesKnotType
      ? detectCrossingField(basePoints, options)
      : evenlySpacedCrossingField(options.samples, segmentIndex, options.simultaneousUncrossings, stage.fourthDimensionWindow);
  const points: Vector3[] = [];
  const visibility: number[] = [];
  for (let i = 0; i < options.samples; i++) {
    const xyz = basePoints[i];
    const field = crossingField[i];
    const lift = options.crossingMode === 'projected intersections' || !changesKnotType ? 0 : options.liftAmplitude * field.signedLift;
    visibility.push(hiddenPassageVisibility(options, changesKnotType, field.window));
    points.push(project4Dto3D(new Vector4(xyz.x, xyz.y, xyz.z, lift), options.projectionDistance4D));
  }
  const frames = buildFrames(points, 0);
  if (Math.abs(options.twistTurns) > 0.0001) {
    for (let i = 0; i < frames.length; i++) {
      const angle = options.twistTurns * Math.PI * 2 * (i / frames.length);
      frames[i].normal.applyAxisAngle(frames[i].tangent, angle).normalize();
      frames[i].binormal.crossVectors(frames[i].tangent, frames[i].normal).normalize();
    }
  }
  return buildVariableRibbonMesh(frames, visibility, options.width, 0.2, options.crossSamples);
}

function smoothstep(x: number) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

function smoothRange(edge0: number, edge1: number, x: number) {
  return smoothstep((x - edge0) / Math.max(0.0001, edge1 - edge0));
}

function smootherstep(x: number) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function stagedProgress(segmentT: number, segmentIndex: number, options: DeveloperRibbonOptions) {
  const relaxation = Math.max(0, Math.min(1, segmentIndex === 0 ? options.canonicalRelaxation : options.intermediateRelaxation));
  const linear = Math.max(0, Math.min(1, segmentT));
  const eased = smootherstep(linear);
  const morph = linear + (eased - linear) * relaxation;
  const duty = Math.max(0.015, options.fourthDimensionDuty);
  const d = morph - 0.5;
  const fourthDimensionWindow = Math.exp(-(d * d) / (2 * duty * duty));
  return {
    morph,
    fourthDimensionWindow,
  };
}

function hiddenPassageVisibility(options: DeveloperRibbonOptions, changesKnotType: boolean, passage: number) {
  if (options.crossingMode !== 'hidden 4D passage' || !changesKnotType) return 1;
  const userNarrowing = options.hideDuringUncrossing * passage;
  const hardOcclusion = smoothRange(0.14, 0.36, passage);
  return Math.max(0, 1 - Math.max(userNarrowing, hardOcclusion));
}

function evenlySpacedCrossingField(samples: number, segmentIndex: number, simultaneousUncrossings: number, temporalWindow: number) {
  const field: CrossingField[] = [];
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * Math.PI * 2;
    const local = localizedLift(t, segmentIndex, simultaneousUncrossings);
    field.push({
      signedLift: temporalWindow * local.signedLift,
      window: temporalWindow * local.window,
    });
  }
  return field;
}

function localizedLift(t: number, segmentIndex: number, simultaneousUncrossings: number) {
  const count = Math.max(1, Math.round(simultaneousUncrossings));
  let signedLift = 0;
  let windowSum = 0;
  for (let i = 0; i < count; i++) {
    const center = ((i + 0.5) / count) * Math.PI * 2 + segmentIndex * 0.73;
    const d = Math.atan2(Math.sin(t - center), Math.cos(t - center));
    const window = Math.exp(-(d * d) / 0.11);
    windowSum += window;
    signedLift += window * (i % 2 === 0 ? 1 : -1);
  }
  return {
    signedLift: signedLift / Math.sqrt(count),
    window: Math.min(1, windowSum),
  };
}

function detectCrossingField(points: Vector3[], options: DeveloperRibbonOptions) {
  const n = points.length;
  const field = Array.from({ length: n }, () => ({ signedLift: 0, window: 0 }));
  const maxCrossings = Math.max(1, Math.round(options.simultaneousUncrossings));
  const minSeparation = Math.max(24, Math.floor(n * 0.045));
  const innerRadius = Math.max(options.width * 1.15, 0.035);
  const outerRadius = Math.max(options.width * 4.25, 0.16);
  const candidates: { a: number; b: number; distance: number }[] = [];

  for (let a = 0; a < n; a++) {
    let bestB = -1;
    let bestDistanceSq = outerRadius * outerRadius;
    for (let b = a + minSeparation; b < n; b++) {
      const wrapped = Math.min(b - a, n - (b - a));
      if (wrapped < minSeparation) continue;
      const distanceSq = points[a].distanceToSquared(points[b]);
      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq;
        bestB = b;
      }
    }
    if (bestB >= 0) {
      candidates.push({ a, b: bestB, distance: Math.sqrt(bestDistanceSq) });
    }
  }

  candidates.sort((left, right) => left.distance - right.distance);
  const accepted: typeof candidates = [];
  for (const candidate of candidates) {
    if (accepted.length >= maxCrossings) break;
    const overlaps = accepted.some((existing) => {
      return cyclicIndexDistance(candidate.a, existing.a, n) < minSeparation || cyclicIndexDistance(candidate.a, existing.b, n) < minSeparation || cyclicIndexDistance(candidate.b, existing.a, n) < minSeparation || cyclicIndexDistance(candidate.b, existing.b, n) < minSeparation;
    });
    if (!overlaps) accepted.push(candidate);
  }

  for (let crossingIndex = 0; crossingIndex < accepted.length; crossingIndex++) {
    const candidate = accepted[crossingIndex];
    const collisionStrength = 1 - smoothRange(innerRadius, outerRadius, candidate.distance);
    if (collisionStrength <= 0) continue;
    paintCrossingWindow(field, candidate.a, 1, collisionStrength, n);
    paintCrossingWindow(field, candidate.b, -1, collisionStrength, n);
  }
  return field;
}

function paintCrossingWindow(field: CrossingField[], center: number, sign: number, strength: number, samples: number) {
  const radius = Math.max(8, Math.floor(samples * 0.022));
  for (let offset = -radius; offset <= radius; offset++) {
    const index = (center + offset + samples) % samples;
    const u = Math.abs(offset) / radius;
    const window = strength * smootherstep(1 - u);
    field[index].window = Math.max(field[index].window, window);
    field[index].signedLift += sign * window;
  }
}

function cyclicIndexDistance(a: number, b: number, samples: number) {
  const d = Math.abs(a - b);
  return Math.min(d, samples - d);
}

function alignedPhase(source: DevKnotKind, target: DevKnotKind, samples: number) {
  const key = `${source}:${target}:${samples}`;
  const cached = phaseCache.get(key);
  if (cached !== undefined) return cached;
  const steps = 96;
  const probes = Math.min(160, Math.max(48, Math.round(samples / 6)));
  let bestPhase = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let s = 0; s < steps; s++) {
    const phase = (s / steps) * Math.PI * 2;
    let score = 0;
    for (let i = 0; i < probes; i++) {
      const t = (i / probes) * Math.PI * 2;
      score += devKnotPoint(source, t).distanceToSquared(devKnotPoint(target, t + phase));
    }
    if (score < bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }
  phaseCache.set(key, bestPhase);
  return bestPhase;
}

function buildVariableRibbonMesh(frames: ReturnType<typeof buildFrames>, visibility: number[], width: number, edgeFlare: number, crossSamples: number) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const n = frames.length;
  const m = crossSamples;

  for (let i = 0; i < n; i++) {
    const f = frames[i];
    const widthScale = visibility[i] ?? 1;
    for (let j = 0; j < m; j++) {
      const v = j / (m - 1);
      const u = v * 2 - 1;
      const edge = Math.pow(Math.abs(u), 3.4);
      const localWidth = width * widthScale;
      const pos = f.position
        .clone()
        .add(f.normal.clone().multiplyScalar(localWidth * u))
        .add(f.outward.clone().multiplyScalar(edgeFlare * edge * localWidth * 0.42));
      const normal = new Vector3()
        .addScaledVector(f.binormal, 0.36)
        .addScaledVector(f.outward, 0.84 + edge * 0.7)
        .addScaledVector(f.normal, u * edgeFlare * 0.18)
        .normalize();
      positions.push(pos.x, pos.y, pos.z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(i / n, v);
    }
  }

  for (let i = 0; i < n; i++) {
    const ni = (i + 1) % n;
    const visibleA = (visibility[i] ?? 1) > 0.035;
    const visibleB = (visibility[ni] ?? 1) > 0.035;
    if (!visibleA || !visibleB) continue;
    for (let j = 0; j < m - 1; j++) {
      const a = i * m + j;
      const b = ni * m + j;
      const c = ni * m + j + 1;
      const d = i * m + j + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
