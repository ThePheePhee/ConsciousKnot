import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import { devKnotPoint } from '../math/devKnots';
import type { DevCrossingMode, DevKnotKind, DevSphereMode, RibbonFrame } from '../math/types';

interface DeveloperRibbonOptions {
  knots: DevKnotKind[];
  progress: number;
  samples: number;
  width: number;
  crossSamples: number;
  liftAmplitude: number;
  projectionDistance4D: number;
  simultaneousUncrossings: number;
  crossingMode: DevCrossingMode;
  showWPassage: boolean;
  sphereMode: DevSphereMode;
  sphereStrength: number;
  sphereRadius: number;
  sphereSymmetry: number;
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
  const stage = stagedProgress(segmentT, options);
  const basePoints: Vector3[] = [];
  for (let i = 0; i < options.samples; i++) {
    const t = (i / options.samples) * Math.PI * 2;
    const source = devKnotPoint(sourceKnot, t);
    const target = devKnotPoint(targetKnot, t + targetPhase);
    basePoints.push(applySphericalEnvelope(source.clone().lerp(target, stage.morph), t, options));
  }
  const crossingField =
    options.crossingMode === 'hidden 4D passage' && changesKnotType
      ? detectCrossingField(basePoints, options, stage.fourthDimensionWindow)
      : evenlySpacedCrossingField(options.samples, segmentIndex, options.simultaneousUncrossings, stage.fourthDimensionWindow);
  const points: Vector3[] = [];
  const widthScale: number[] = [];
  const wIntensity: number[] = [];
  const wAlpha: number[] = [];
  for (let i = 0; i < options.samples; i++) {
    const xyz = basePoints[i];
    const field = crossingField[i];
    const passage = Math.max(0, Math.min(1, field.window));
    const wDepth = Math.max(0, Math.min(1, Math.abs(field.signedLift)));
    widthScale.push(options.showWPassage ? 1 : hiddenPassageVisibility(options, changesKnotType, passage));
    wIntensity.push(options.showWPassage && options.crossingMode === 'hidden 4D passage' && wDepth > 0.0001 ? 1 : 0);
    wAlpha.push(options.showWPassage && options.crossingMode === 'hidden 4D passage' ? 1 - 0.9 * smootherstep(wDepth) : 1);
    points.push(xyz.clone());
  }
  const frames = buildRadialDeveloperFrames(basePoints, points);
  if (Math.abs(options.twistTurns) > 0.0001) {
    for (let i = 0; i < frames.length; i++) {
      const angle = options.twistTurns * Math.PI * 2 * (i / frames.length);
      frames[i].normal.applyAxisAngle(frames[i].tangent, angle).normalize();
      frames[i].binormal.crossVectors(frames[i].tangent, frames[i].normal).normalize();
    }
  }
  return buildVariableRibbonMesh(frames, widthScale, wIntensity, wAlpha, options.width, 0.2, options.crossSamples);
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

function stagedProgress(segmentT: number, options: DeveloperRibbonOptions) {
  const linear = Math.max(0, Math.min(1, segmentT));
  const duty = Math.max(0.015, options.fourthDimensionDuty);
  const d = linear - 0.5;
  const fourthDimensionWindow = Math.exp(-(d * d) / (2 * duty * duty));
  return {
    morph: linear,
    fourthDimensionWindow,
  };
}

function applySphericalEnvelope(point: Vector3, t: number, options: DeveloperRibbonOptions) {
  if (options.sphereMode === 'off' || options.sphereStrength <= 0) return point;
  const strength = Math.max(0, Math.min(1, options.sphereStrength));
  const radius = Math.max(0.001, options.sphereRadius);
  const length = point.length();
  if (length < 0.0001) return point;
  if (options.sphereMode === 'contain ball') {
    if (length <= radius) return point;
    return point.clone().lerp(point.clone().multiplyScalar(radius / length), strength);
  }
  const direction = point.clone().normalize();
  const symmetry = Math.max(3, Math.round(options.sphereSymmetry));
  const shellRipple = options.sphereMode === 'symmetric shell'
    ? 1 + 0.045 * Math.sin(symmetry * t) + 0.025 * Math.sin((symmetry + 2) * t + Math.PI / symmetry)
    : 1;
  const shell = direction.multiplyScalar(radius * shellRipple);
  return point.clone().lerp(shell, strength);
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

function detectCrossingField(points: Vector3[], options: DeveloperRibbonOptions, temporalWindow: number) {
  const n = points.length;
  const field = Array.from({ length: n }, () => ({ signedLift: 0, window: 0 }));
  if (temporalWindow < 0.01) return field;
  const maxCrossings = Math.max(1, Math.round(options.simultaneousUncrossings));
  const minSeparation = Math.max(24, Math.floor(n * 0.045));
  const candidates: { a: number; b: number; depthGap: number }[] = [];

  for (let a = 0; a < n; a++) {
    const aNext = (a + 1) % n;
    for (let b = a + minSeparation; b < n; b++) {
      const bNext = (b + 1) % n;
      const wrapped = Math.min(b - a, n - (b - a));
      if (wrapped < minSeparation) continue;
      if (cyclicIndexDistance(aNext, b, n) < minSeparation || cyclicIndexDistance(a, bNext, n) < minSeparation) continue;
      const hit = projectedSegmentIntersection(points[a], points[aNext], points[b], points[bNext]);
      if (!hit) continue;
      const az = points[a].z + (points[aNext].z - points[a].z) * hit.ua;
      const bz = points[b].z + (points[bNext].z - points[b].z) * hit.ub;
      candidates.push({ a: a + hit.ua, b: b + hit.ub, depthGap: Math.abs(az - bz) });
    }
  }

  candidates.sort((left, right) => left.depthGap - right.depthGap);
  const accepted: typeof candidates = [];
  for (const candidate of candidates) {
    if (accepted.length >= maxCrossings) break;
    const overlaps = accepted.some((existing) => {
      return cyclicFloatDistance(candidate.a, existing.a, n) < minSeparation || cyclicFloatDistance(candidate.a, existing.b, n) < minSeparation || cyclicFloatDistance(candidate.b, existing.a, n) < minSeparation || cyclicFloatDistance(candidate.b, existing.b, n) < minSeparation;
    });
    if (!overlaps) accepted.push(candidate);
  }

  for (let crossingIndex = 0; crossingIndex < accepted.length; crossingIndex++) {
    const candidate = accepted[crossingIndex];
    const collisionStrength = temporalWindow;
    if (collisionStrength <= 0) continue;
    paintCrossingWindow(field, candidate.a, 1, collisionStrength, n);
    paintCrossingWindow(field, candidate.b, -1, collisionStrength, n);
  }
  return field;
}

function projectedSegmentIntersection(a0: Vector3, a1: Vector3, b0: Vector3, b1: Vector3) {
  const rx = a1.x - a0.x;
  const ry = a1.y - a0.y;
  const sx = b1.x - b0.x;
  const sy = b1.y - b0.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 0.000001) return null;
  const qpx = b0.x - a0.x;
  const qpy = b0.y - a0.y;
  const ua = (qpx * sy - qpy * sx) / denom;
  const ub = (qpx * ry - qpy * rx) / denom;
  if (ua <= 0.02 || ua >= 0.98 || ub <= 0.02 || ub >= 0.98) return null;
  return { ua, ub };
}

function paintCrossingWindow(field: CrossingField[], center: number, sign: number, strength: number, samples: number) {
  const radius = Math.max(12, Math.floor(samples * 0.04));
  for (let offset = -radius; offset <= radius; offset++) {
    const index = (Math.round(center) + offset + samples) % samples;
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

function cyclicFloatDistance(a: number, b: number, samples: number) {
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

function buildRadialDeveloperFrames(framePoints: Vector3[], displayPoints: Vector3[]) {
  const n = framePoints.length;
  const frames: RibbonFrame[] = [];
  for (let i = 0; i < n; i++) {
    const tangent = framePoints[(i + 1) % n].clone().sub(framePoints[(i - 1 + n) % n]).normalize();
    const radial = framePoints[i].lengthSq() > 0.0001 ? framePoints[i].clone().normalize() : new Vector3(0, 0, 1);
    let normal = radial.sub(tangent.clone().multiplyScalar(radial.dot(tangent)));
    if (normal.lengthSq() < 0.0001) normal = projectedReferenceNormal(tangent);
    normal.sub(tangent.clone().multiplyScalar(normal.dot(tangent))).normalize();
    const binormal = tangent.clone().cross(normal).normalize();
    frames.push({
      position: displayPoints[i],
      tangent,
      normal,
      binormal,
      outward: displayPoints[i].clone().normalize(),
      pinch: 1,
    });
  }
  return frames;
}

function projectedReferenceNormal(tangent: Vector3) {
  const references = [new Vector3(0, 0, 1), new Vector3(0, 1, 0), new Vector3(1, 0, 0)];
  let best = new Vector3(1, 0, 0);
  let bestLength = -1;
  for (const reference of references) {
    const projected = reference.clone().sub(tangent.clone().multiplyScalar(reference.dot(tangent)));
    const length = projected.lengthSq();
    if (length > bestLength) {
      best = projected;
      bestLength = length;
    }
  }
  return best.normalize();
}

function buildVariableRibbonMesh(frames: RibbonFrame[], widthScale: number[], wIntensity: number[], wAlpha: number[], width: number, edgeFlare: number, crossSamples: number) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const wIntensities: number[] = [];
  const wAlphas: number[] = [];
  const indices: number[] = [];
  const n = frames.length;
  const m = crossSamples;

  for (let i = 0; i < n; i++) {
    const f = frames[i];
    const localScale = widthScale[i] ?? 1;
    for (let j = 0; j < m; j++) {
      const v = j / (m - 1);
      const u = v * 2 - 1;
      const edge = Math.pow(Math.abs(u), 3.4);
      const localWidth = width * localScale;
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
      wIntensities.push(wIntensity[i] ?? 0);
      wAlphas.push(wAlpha[i] ?? 1);
    }
  }

  for (let i = 0; i < n; i++) {
    const ni = (i + 1) % n;
    const visibleA = (widthScale[i] ?? 1) > 0.035;
    const visibleB = (widthScale[ni] ?? 1) > 0.035;
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
  geometry.setAttribute('aWIntensity', new BufferAttribute(new Float32Array(wIntensities), 1));
  geometry.setAttribute('aWAlpha', new BufferAttribute(new Float32Array(wAlphas), 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
