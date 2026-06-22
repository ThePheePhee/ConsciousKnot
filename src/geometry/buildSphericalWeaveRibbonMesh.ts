import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import { shellPatternCrossings, shellPatternPoint } from '../math/sphericalWeaves';
import type { DevShellPattern, RibbonFrame } from '../math/types';

interface SphericalWeaveOptions {
  sourcePattern: DevShellPattern;
  targetPattern: DevShellPattern;
  progress: number;
  samples: number;
  width: number;
  crossSamples: number;
  shellRadius: number;
  shellThickness: number;
  liftAmplitude: number;
  showWPassage: boolean;
  selfAvoidanceStrength: number;
  selfAvoidanceIterations: number;
  tubeClearance: number;
}

interface ShellSample {
  direction: Vector3;
  height: number;
  wWindow: number;
}

interface PatternSample {
  direction: Vector3;
  height: number;
}

export function buildSphericalWeaveRibbonMesh(options: SphericalWeaveOptions) {
  const samples = Math.max(96, Math.round(options.samples));
  const source = samplePattern(options.sourcePattern, samples, options.shellThickness);
  const target = samplePattern(options.targetPattern, samples, options.shellThickness);
  const progress = clamp01(options.progress);
  const crossingWindow = Math.sin(Math.PI * progress);
  const changingPattern = options.sourcePattern !== options.targetPattern;
  const passageCount = Math.max(1, Math.abs(shellPatternCrossings(options.targetPattern) - shellPatternCrossings(options.sourcePattern)) || Math.min(4, Math.max(1, shellPatternCrossings(options.targetPattern))));
  const shellSamples: ShellSample[] = [];

  for (let i = 0; i < samples; i++) {
    const t = i / samples;
    const direction = slerpUnit(source[i].direction, target[i].direction, progress);
    const height = lerp(source[i].height, target[i].height, progress);
    const localPassage = changingPattern ? localizedPassage(t, passageCount, progress) : 0;
    shellSamples.push({
      direction,
      height,
      wWindow: crossingWindow * localPassage,
    });
  }

  resolveShellEmbedding(shellSamples, options);
  const frames = buildShellFrames(shellSamples, options);
  const wDepths = shellSamples.map((sample) => clamp01(sample.wWindow * Math.max(0, options.liftAmplitude) / 1.25));
  const widthScale = wDepths.map((wDepth) => options.showWPassage ? 1 : Math.max(0.08, 1 - 0.88 * wDepth));
  const wIntensity = wDepths.map((wDepth) => options.showWPassage && wDepth > 0.0001 ? 1 : 0);
  const wAlpha = wDepths.map((wDepth) => options.showWPassage ? 1 - 0.86 * smootherstep(wDepth) : 1);
  return buildShellRibbonMesh(frames, widthScale, wIntensity, wAlpha, options.width, options.crossSamples);
}

function samplePattern(pattern: DevShellPattern, samples: number, shellThickness: number) {
  const points: Vector3[] = [];
  const lengths: number[] = [];
  for (let i = 0; i < samples; i++) {
    const theta = (i / samples) * Math.PI * 2;
    const point = shellPatternPoint(pattern, theta);
    points.push(point);
    lengths.push(point.length());
  }
  const mean = lengths.reduce((sum, value) => sum + value, 0) / samples;
  const scale = Math.max(0.0001, lengths.reduce((max, value) => Math.max(max, Math.abs(value - mean)), 0));
  return points.map((point, i): PatternSample => {
    const direction = point.lengthSq() > 0.000001 ? point.clone().normalize() : new Vector3(0, 0, 1);
    const rawLayer = pattern === 'unknot shell' ? 0 : (lengths[i] - mean) / scale;
    return {
      direction,
      height: clamp(rawLayer * shellThickness * 0.42, -shellThickness * 0.46, shellThickness * 0.46),
    };
  });
}

function resolveShellEmbedding(samples: ShellSample[], options: SphericalWeaveOptions) {
  const n = samples.length;
  const radius = Math.max(0.2, options.shellRadius);
  const thickness = Math.max(options.width * 3.0, options.shellThickness);
  const limit = thickness * 0.48;
  const iterations = Math.max(5, Math.round(options.selfAvoidanceIterations));
  const strength = Math.max(0.55, Math.min(1, options.selfAvoidanceStrength));
  const clearance = Math.max(options.width * Math.max(2.35, options.tubeClearance), options.width + 0.04);
  const guard = Math.max(12, Math.floor(n * 0.024));

  for (let pass = 0; pass < iterations; pass++) {
    const positions = shellPositions(samples, radius);
    const tangentPushes = Array.from({ length: n }, () => new Vector3());
    const heightPushes = new Float32Array(n);
    const weights = new Float32Array(n);

    accumulatePointSeparation(samples, positions, tangentPushes, heightPushes, weights, clearance, guard, strength);
    if (pass < 2) accumulateSegmentSeparation(samples, positions, tangentPushes, heightPushes, weights, clearance, guard, strength);

    for (let i = 0; i < n; i++) {
      if (weights[i] <= 0) continue;
      const inv = 1 / weights[i];
      const tangent = tangentPushes[i].multiplyScalar(inv / Math.max(0.4, radius + samples[i].height));
      samples[i].direction.add(tangent.multiplyScalar(0.62)).normalize();
      samples[i].height = clamp(samples[i].height + heightPushes[i] * inv * 0.82, -limit, limit);
    }

    smoothShell(samples, 0.045 * strength, limit);
  }
}

function accumulatePointSeparation(
  samples: ShellSample[],
  positions: Vector3[],
  tangentPushes: Vector3[],
  heightPushes: Float32Array,
  weights: Float32Array,
  clearance: number,
  guard: number,
  strength: number,
) {
  const n = samples.length;
  const clearanceSq = clearance * clearance;
  const grid = buildSpatialGrid(positions, clearance);
  for (let i = 0; i < n; i++) {
    const nearby = nearbySpatialIndices(grid, positions[i], clearance);
    for (const j of nearby) {
      if (j <= i) continue;
      if (cyclicIndexDistance(i, j, n) < guard) continue;
      const delta = positions[i].clone().sub(positions[j]);
      const distanceSq = delta.lengthSq();
      if (distanceSq >= clearanceSq) continue;
      const distance = Math.sqrt(Math.max(0.0000001, distanceSq));
      const amount = ((clearance - distance) / clearance) * clearance * strength;
      const direction = stableDirection(delta, i, j);
      addShellPush(samples, tangentPushes, heightPushes, weights, i, direction, amount);
      addShellPush(samples, tangentPushes, heightPushes, weights, j, direction.clone().multiplyScalar(-1), amount);
    }
  }
}

function accumulateSegmentSeparation(
  samples: ShellSample[],
  positions: Vector3[],
  tangentPushes: Vector3[],
  heightPushes: Float32Array,
  weights: Float32Array,
  clearance: number,
  guard: number,
  strength: number,
) {
  const n = samples.length;
  const clearanceSq = clearance * clearance;
  for (let i = 0; i < n; i++) {
    const iNext = (i + 1) % n;
    for (let j = i + guard; j < n; j++) {
      const jNext = (j + 1) % n;
      if (cyclicIndexDistance(i, j, n) < guard || cyclicIndexDistance(iNext, j, n) < guard || cyclicIndexDistance(i, jNext, n) < guard) continue;
      const closest = closestSegmentParameters(positions[i], positions[iNext], positions[j], positions[jNext]);
      if (closest.distanceSq >= clearanceSq) continue;
      const distance = Math.sqrt(Math.max(0.0000001, closest.distanceSq));
      const amount = ((clearance - distance) / clearance) * clearance * strength * 0.72;
      const direction = stableDirection(closest.delta, i, j);
      addShellPush(samples, tangentPushes, heightPushes, weights, i, direction, amount * (1 - closest.s));
      addShellPush(samples, tangentPushes, heightPushes, weights, iNext, direction, amount * closest.s);
      addShellPush(samples, tangentPushes, heightPushes, weights, j, direction.clone().multiplyScalar(-1), amount * (1 - closest.t));
      addShellPush(samples, tangentPushes, heightPushes, weights, jNext, direction.clone().multiplyScalar(-1), amount * closest.t);
    }
  }
}

function buildSpatialGrid(positions: Vector3[], cellSize: number) {
  const grid = new Map<string, number[]>();
  for (let i = 0; i < positions.length; i++) {
    const key = spatialKey(positions[i], cellSize);
    const bucket = grid.get(key);
    if (bucket) bucket.push(i);
    else grid.set(key, [i]);
  }
  return grid;
}

function nearbySpatialIndices(grid: Map<string, number[]>, point: Vector3, cellSize: number) {
  const cx = Math.floor(point.x / cellSize);
  const cy = Math.floor(point.y / cellSize);
  const cz = Math.floor(point.z / cellSize);
  const indices: number[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        const bucket = grid.get(`${cx + dx}:${cy + dy}:${cz + dz}`);
        if (bucket) indices.push(...bucket);
      }
    }
  }
  return indices;
}

function spatialKey(point: Vector3, cellSize: number) {
  return `${Math.floor(point.x / cellSize)}:${Math.floor(point.y / cellSize)}:${Math.floor(point.z / cellSize)}`;
}

function addShellPush(
  samples: ShellSample[],
  tangentPushes: Vector3[],
  heightPushes: Float32Array,
  weights: Float32Array,
  index: number,
  direction: Vector3,
  amount: number,
) {
  if (amount <= 0) return;
  const radial = samples[index].direction;
  const radialPart = direction.dot(radial);
  const tangentPart = direction.clone().sub(radial.clone().multiplyScalar(radialPart));
  tangentPushes[index].addScaledVector(tangentPart, amount);
  heightPushes[index] += radialPart * amount;
  weights[index] += 1;
}

function smoothShell(samples: ShellSample[], amount: number, heightLimit: number) {
  if (amount <= 0) return;
  const n = samples.length;
  const nextDirections: Vector3[] = [];
  const nextHeights = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const prev = samples[(i - 1 + n) % n];
    const next = samples[(i + 1) % n];
    const averageDirection = prev.direction.clone().add(next.direction).normalize();
    nextDirections.push(slerpUnit(samples[i].direction, averageDirection, amount));
    nextHeights[i] = clamp(lerp(samples[i].height, (prev.height + next.height) * 0.5, amount * 1.4), -heightLimit, heightLimit);
  }
  for (let i = 0; i < n; i++) {
    samples[i].direction.copy(nextDirections[i]);
    samples[i].height = nextHeights[i];
  }
}

function buildShellFrames(samples: ShellSample[], options: SphericalWeaveOptions) {
  const positions = shellPositions(samples, Math.max(0.2, options.shellRadius));
  const n = samples.length;
  const frames: RibbonFrame[] = [];
  for (let i = 0; i < n; i++) {
    const tangent = positions[(i + 1) % n].clone().sub(positions[(i - 1 + n) % n]).normalize();
    const outward = samples[i].direction.clone().normalize();
    let widthDirection = outward.clone().cross(tangent).normalize();
    if (widthDirection.lengthSq() < 0.000001) widthDirection = projectedReferenceNormal(tangent);
    const binormal = tangent.clone().cross(widthDirection).normalize();
    frames.push({
      position: positions[i],
      tangent,
      normal: widthDirection,
      binormal,
      outward,
      pinch: 1,
    });
  }
  return frames;
}

function buildShellRibbonMesh(frames: RibbonFrame[], widthScale: number[], wIntensity: number[], wAlpha: number[], width: number, crossSamples: number) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const wIntensities: number[] = [];
  const wAlphas: number[] = [];
  const indices: number[] = [];
  const n = frames.length;
  const m = Math.max(4, crossSamples);

  for (let i = 0; i < n; i++) {
    const f = frames[i];
    const localScale = widthScale[i] ?? 1;
    for (let j = 0; j < m; j++) {
      const v = j / (m - 1);
      const u = v * 2 - 1;
      const edge = Math.pow(Math.abs(u), 2.8);
      const localWidth = width * localScale;
      const pos = f.position
        .clone()
        .addScaledVector(f.normal, localWidth * u)
        .addScaledVector(f.outward, edge * localWidth * 0.08);
      const normal = f.outward
        .clone()
        .multiplyScalar(0.92 + edge * 0.4)
        .addScaledVector(f.binormal, 0.18)
        .addScaledVector(f.normal, u * 0.08)
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
    const visibleA = (widthScale[i] ?? 1) > 0.04;
    const visibleB = (widthScale[ni] ?? 1) > 0.04;
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

function shellPositions(samples: ShellSample[], radius: number) {
  return samples.map((sample) => sample.direction.clone().multiplyScalar(radius + sample.height));
}

function localizedPassage(t: number, count: number, progress: number) {
  let sum = 0;
  const phase = progress * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const center = ((i + 0.5) / count + 0.035 * Math.sin(phase + i)) % 1;
    const d = cyclicUnitDistance(t, center);
    sum += Math.exp(-(d * d) / 0.0018);
  }
  return clamp01(sum);
}

function slerpUnit(a: Vector3, b: Vector3, t: number) {
  const amount = clamp01(t);
  const dot = clamp(a.dot(b), -0.9995, 0.9995);
  const theta = Math.acos(dot) * amount;
  const relative = b.clone().sub(a.clone().multiplyScalar(dot));
  if (relative.lengthSq() < 0.000001) return a.clone().lerp(b, amount).normalize();
  relative.normalize();
  return a.clone().multiplyScalar(Math.cos(theta)).add(relative.multiplyScalar(Math.sin(theta))).normalize();
}

function closestSegmentParameters(a0: Vector3, a1: Vector3, b0: Vector3, b1: Vector3) {
  const u = a1.clone().sub(a0);
  const v = b1.clone().sub(b0);
  const w = a0.clone().sub(b0);
  const aa = u.dot(u);
  const bb = v.dot(v);
  const ab = u.dot(v);
  const aw = u.dot(w);
  const bw = v.dot(w);
  const denom = aa * bb - ab * ab;
  let s = denom > 0.0000001 ? (ab * bw - bb * aw) / denom : 0;
  let t = denom > 0.0000001 ? (aa * bw - ab * aw) / denom : 0;
  s = clamp01(s);
  t = clamp01(t);
  const aPoint = a0.clone().addScaledVector(u, s);
  const bPoint = b0.clone().addScaledVector(v, t);
  const delta = aPoint.clone().sub(bPoint);
  return { s, t, delta, distanceSq: delta.lengthSq() };
}

function stableDirection(delta: Vector3, i: number, j: number) {
  if (delta.lengthSq() > 0.0000001) return delta.normalize();
  const seed = Math.sin((i + 1) * 12.9898 + (j + 1) * 78.233) * 43758.5453;
  const angle = (seed - Math.floor(seed)) * Math.PI * 2;
  return new Vector3(Math.cos(angle), Math.sin(angle), Math.sin(angle * 1.7)).normalize();
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

function cyclicIndexDistance(a: number, b: number, samples: number) {
  const d = Math.abs(a - b);
  return Math.min(d, samples - d);
}

function cyclicUnitDistance(a: number, b: number) {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

function smootherstep(x: number) {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
