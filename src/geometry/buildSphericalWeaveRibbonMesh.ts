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
  symmetryOrder: number;
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

interface SurfaceProbe {
  index: number;
  position: Vector3;
  edgeWeight: number;
}

export function buildSphericalWeaveRibbonMesh(options: SphericalWeaveOptions) {
  const samples = Math.max(96, Math.round(options.samples));
  const source = samplePattern(options.sourcePattern, samples, options.shellThickness);
  const target = samplePattern(options.targetPattern, samples, options.shellThickness);
  const progress = clamp01(options.progress);
  const changingPattern = options.sourcePattern !== options.targetPattern;
  const eventCount = transitionEventCount(options.sourcePattern, options.targetPattern);
  const shellSamples: ShellSample[] = [];

  for (let i = 0; i < samples; i++) {
    const t = i / samples;
    const event = changingPattern ? scheduledCrossingTransition(t, eventCount, progress) : { blend: 0, wWindow: 0 };
    const direction = slerpUnit(source[i].direction, target[i].direction, event.blend);
    const height = lerp(source[i].height, target[i].height, event.blend);
    shellSamples.push({
      direction,
      height,
      wWindow: Math.abs(options.liftAmplitude) > 0.0001 ? event.wWindow : 0,
    });
  }

  resolveShellEmbedding(shellSamples, options);
  const frames = buildShellFrames(shellSamples, options);
  const wDepths = shellSamples.map((sample) => clamp01(sample.wWindow));
  const widthScale = wDepths.map((wDepth) => options.showWPassage || wDepth <= 0.001 ? 1 : 0);
  const wIntensity = wDepths.map((wDepth) => options.showWPassage && wDepth > 0.001 ? 1 : 0);
  const wAlpha = wDepths.map((wDepth) => options.showWPassage && wDepth > 0.001 ? 0.12 + 0.34 * (1 - smootherstep(wDepth)) : 1);
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
  const iterations = Math.max(6, Math.round(options.selfAvoidanceIterations) + 2);
  const strength = clamp(options.selfAvoidanceStrength, 0, 1);
  if (strength <= 0 || iterations <= 0) return;

  const clearance = Math.max(options.width * Math.max(3.45, options.tubeClearance * 1.08), options.width + 0.075);
  const surfaceClearance = Math.max(options.width * 0.62, 0.035);
  const guard = Math.max(12, Math.floor(n * 0.024));
  const symmetryOrder = Math.max(2, Math.round(options.symmetryOrder));

  for (let pass = 0; pass < iterations; pass++) {
    applySeparationPass(samples, radius, clearance, guard, strength, true, limit);
    smoothShell(samples, 0.045 * strength, limit);
    relaxCurveEnergy(samples, radius, limit, 0.055 * strength);
    applyRibbonFootprintPass(samples, radius, options.width, surfaceClearance, guard, strength * 0.78, limit, symmetryOrder);
    applySeparationPass(samples, radius, clearance, guard, strength * 0.86, pass < 4, limit);
  }

  for (let pass = 0; pass < 5; pass++) {
    relaxCurveEnergy(samples, radius, limit, 0.028 * strength);
    smoothShell(samples, 0.018 * strength, limit);
    applyRibbonFootprintPass(samples, radius, options.width, surfaceClearance, guard, strength * (0.9 + pass * 0.09), limit, symmetryOrder);
    applySeparationPass(samples, radius, clearance, guard, strength * (0.95 + pass * 0.08), true, limit);
  }
}

function applySeparationPass(
  samples: ShellSample[],
  radius: number,
  clearance: number,
  guard: number,
  strength: number,
  includeSegments: boolean,
  heightLimit: number,
) {
  const n = samples.length;
  const positions = shellPositions(samples, radius);
  const tangentPushes = Array.from({ length: n }, () => new Vector3());
  const heightPushes = new Float32Array(n);
  const weights = new Float32Array(n);

  accumulatePointSeparation(samples, positions, tangentPushes, heightPushes, weights, clearance, guard, strength);
  if (includeSegments) accumulateSegmentSeparation(samples, positions, tangentPushes, heightPushes, weights, clearance, guard, strength);

  for (let i = 0; i < n; i++) {
    if (weights[i] <= 0) continue;
    const inv = 1 / weights[i];
    const tangent = tangentPushes[i].multiplyScalar(inv / Math.max(0.4, radius + samples[i].height));
    samples[i].direction.add(tangent.multiplyScalar(0.66)).normalize();
    samples[i].height = clamp(samples[i].height + heightPushes[i] * inv * 0.86, -heightLimit, heightLimit);
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
      const pairWeight = sampleCollisionWeight(samples[i]) * sampleCollisionWeight(samples[j]);
      if (pairWeight <= 0.0001) continue;
      const delta = positions[i].clone().sub(positions[j]);
      const distanceSq = delta.lengthSq();
      if (distanceSq >= clearanceSq) continue;
      const distance = Math.sqrt(Math.max(0.0000001, distanceSq));
      const amount = ((clearance - distance) / clearance) * clearance * strength * pairWeight;
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
      const pairWeight = segmentCollisionWeight(samples, i, iNext) * segmentCollisionWeight(samples, j, jNext);
      if (pairWeight <= 0.0001) continue;
      const closest = closestSegmentParameters(positions[i], positions[iNext], positions[j], positions[jNext]);
      if (closest.distanceSq >= clearanceSq) continue;
      const distance = Math.sqrt(Math.max(0.0000001, closest.distanceSq));
      const amount = ((clearance - distance) / clearance) * clearance * strength * 0.72 * pairWeight;
      const direction = stableDirection(closest.delta, i, j);
      addShellPush(samples, tangentPushes, heightPushes, weights, i, direction, amount * (1 - closest.s));
      addShellPush(samples, tangentPushes, heightPushes, weights, iNext, direction, amount * closest.s);
      addShellPush(samples, tangentPushes, heightPushes, weights, j, direction.clone().multiplyScalar(-1), amount * (1 - closest.t));
      addShellPush(samples, tangentPushes, heightPushes, weights, jNext, direction.clone().multiplyScalar(-1), amount * closest.t);
    }
  }
}

function applyRibbonFootprintPass(
  samples: ShellSample[],
  radius: number,
  ribbonWidth: number,
  clearance: number,
  guard: number,
  strength: number,
  heightLimit: number,
  symmetryOrder: number,
) {
  const n = samples.length;
  const probes = buildSurfaceProbes(samples, radius, ribbonWidth);
  const positions = probes.map((probe) => probe.position);
  const grid = buildSpatialGrid(positions, Math.max(clearance * 1.7, ribbonWidth * 0.82));
  const tangentPushes = Array.from({ length: n }, () => new Vector3());
  const heightPushes = new Float32Array(n);
  const weights = new Float32Array(n);
  const clearanceSq = clearance * clearance;

  for (let p = 0; p < probes.length; p++) {
    const probe = probes[p];
    const nearby = nearbySpatialIndices(grid, probe.position, Math.max(clearance * 1.7, ribbonWidth * 0.82));
    for (const q of nearby) {
      if (q <= p) continue;
      const other = probes[q];
      if (cyclicIndexDistance(probe.index, other.index, n) < guard) continue;
      const pairWeight = sampleCollisionWeight(samples[probe.index]) * sampleCollisionWeight(samples[other.index]);
      if (pairWeight <= 0.0001) continue;

      const delta = probe.position.clone().sub(other.position);
      const distanceSq = delta.lengthSq();
      if (distanceSq >= clearanceSq) continue;
      const distance = Math.sqrt(Math.max(0.0000001, distanceSq));
      const overlap = (clearance - distance) / clearance;
      const laneWeight = Math.max(probe.edgeWeight, other.edgeWeight);
      const amount = overlap * overlap * clearance * strength * pairWeight * laneWeight;
      if (amount <= 0) continue;

      const separation = stableDirection(delta, probe.index, other.index);
      const curl = symmetricCurlDirection(samples[probe.index].direction, separation, probe.index, symmetryOrder);
      const response = separation.clone().multiplyScalar(0.74).addScaledVector(curl, 0.26 * overlap).normalize();
      addShellPush(samples, tangentPushes, heightPushes, weights, probe.index, response, amount);
      addShellPush(samples, tangentPushes, heightPushes, weights, other.index, response.clone().multiplyScalar(-1), amount);
    }
  }

  for (let i = 0; i < n; i++) {
    if (weights[i] <= 0) continue;
    const inv = 1 / weights[i];
    const tangent = tangentPushes[i].multiplyScalar(inv / Math.max(0.4, radius + samples[i].height));
    samples[i].direction.add(tangent.multiplyScalar(0.72)).normalize();
    samples[i].height = clamp(samples[i].height + heightPushes[i] * inv * 0.72, -heightLimit, heightLimit);
  }
}

function buildSurfaceProbes(samples: ShellSample[], radius: number, ribbonWidth: number) {
  const centerline = shellPositions(samples, radius);
  const probes: SurfaceProbe[] = [];
  const n = samples.length;
  const lanes = [-0.96, -0.48, 0, 0.48, 0.96];

  for (let i = 0; i < n; i++) {
    const tangent = centerline[(i + 1) % n].clone().sub(centerline[(i - 1 + n) % n]).normalize();
    const outward = samples[i].direction.clone().normalize();
    let widthDirection = outward.clone().cross(tangent).normalize();
    if (widthDirection.lengthSq() < 0.000001) widthDirection = projectedReferenceNormal(tangent);

    for (const lane of lanes) {
      const edge = Math.pow(Math.abs(lane), 2.8);
      probes.push({
        index: i,
        edgeWeight: 0.58 + edge * 0.52,
        position: centerline[i]
          .clone()
          .addScaledVector(widthDirection, ribbonWidth * lane)
          .addScaledVector(outward, edge * ribbonWidth * 0.08),
      });
    }
  }

  return probes;
}

function sampleCollisionWeight(sample: ShellSample) {
  return 1 - smootherstep(clamp01(sample.wWindow * 1.35));
}

function segmentCollisionWeight(samples: ShellSample[], a: number, b: number) {
  return Math.min(sampleCollisionWeight(samples[a]), sampleCollisionWeight(samples[b]));
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
    const localAmount = amount * (0.35 + 0.65 * sampleCollisionWeight(samples[i]));
    const averageDirection = prev.direction.clone().add(next.direction).normalize();
    nextDirections.push(slerpUnit(samples[i].direction, averageDirection, localAmount));
    nextHeights[i] = clamp(lerp(samples[i].height, (prev.height + next.height) * 0.5, localAmount * 1.4), -heightLimit, heightLimit);
  }
  for (let i = 0; i < n; i++) {
    samples[i].direction.copy(nextDirections[i]);
    samples[i].height = nextHeights[i];
  }
}

function relaxCurveEnergy(samples: ShellSample[], radius: number, heightLimit: number, amount: number) {
  if (amount <= 0) return;
  const n = samples.length;
  const positions = shellPositions(samples, radius);
  let meanLength = 0;
  for (let i = 0; i < n; i++) meanLength += positions[i].distanceTo(positions[(i + 1) % n]);
  meanLength /= n;

  const directionUpdates: Vector3[] = [];
  const heightUpdates = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const next = (i + 1) % n;
    const current = positions[i];
    const toPrev = positions[prev].clone().sub(current);
    const toNext = positions[next].clone().sub(current);
    const prevLength = Math.max(0.0001, toPrev.length());
    const nextLength = Math.max(0.0001, toNext.length());
    const spring = toPrev
      .multiplyScalar((prevLength - meanLength) / prevLength)
      .add(toNext.multiplyScalar((nextLength - meanLength) / nextLength));
    const curvature = positions[prev].clone().add(positions[next]).multiplyScalar(0.5).sub(current);
    const force = spring.multiplyScalar(0.55).add(curvature.multiplyScalar(0.45));
    const radial = samples[i].direction;
    const radialPart = force.dot(radial);
    const tangentPart = force.sub(radial.clone().multiplyScalar(radialPart));
    const localAmount = amount * (0.32 + 0.68 * sampleCollisionWeight(samples[i]));
    directionUpdates.push(tangentPart.multiplyScalar(localAmount / Math.max(0.4, radius + samples[i].height)));
    const neighborHeight = (samples[prev].height + samples[next].height) * 0.5;
    heightUpdates[i] = clamp(samples[i].height + (radialPart + (neighborHeight - samples[i].height) * 0.5) * localAmount, -heightLimit, heightLimit);
  }

  for (let i = 0; i < n; i++) {
    samples[i].direction.add(directionUpdates[i]).normalize();
    samples[i].height = heightUpdates[i];
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

function transitionEventCount(sourcePattern: DevShellPattern, targetPattern: DevShellPattern) {
  if (sourcePattern === targetPattern) return 1;
  const sourceCrossings = shellPatternCrossings(sourcePattern);
  const targetCrossings = shellPatternCrossings(targetPattern);
  return Math.max(1, Math.min(36, Math.max(sourceCrossings, targetCrossings, Math.abs(targetCrossings - sourceCrossings))));
}

function scheduledCrossingTransition(u: number, eventCount: number, progress: number) {
  const phase = clamp01(progress);
  if (phase <= 0) return { blend: 0, wWindow: 0 };
  if (phase >= 1) return { blend: 1, wWindow: 0 };

  const eventPosition = phase * eventCount;
  const activeEvent = Math.min(eventCount - 1, Math.floor(eventPosition));
  const localTime = eventPosition - activeEvent;
  const blendRadius = Math.min(0.18, Math.max(0.52 / eventCount, 0.026));
  const passageRadius = Math.min(blendRadius * 0.62, Math.max(0.012, 0.28 / eventCount));
  let blend = 0;

  for (let eventIndex = 0; eventIndex < eventCount; eventIndex++) {
    const state = eventState(eventIndex, activeEvent, localTime);
    if (state <= 0) continue;
    const center = crossingEventCenter(eventIndex, eventCount);
    const spatial = compactLocalBump(cyclicUnitDistance(u, center), blendRadius);
    blend = Math.max(blend, state * spatial);
  }

  const activeCenter = crossingEventCenter(activeEvent, eventCount);
  const activeSpatial = compactLocalBump(cyclicUnitDistance(u, activeCenter), passageRadius);
  const wWindow = activeSpatial * compactEventWWindow(localTime);
  return { blend: clamp01(blend), wWindow };
}

function eventState(eventIndex: number, activeEvent: number, localTime: number) {
  if (eventIndex < activeEvent) return 1;
  if (eventIndex > activeEvent) return 0;
  return smootherstep(localTime);
}

function crossingEventCenter(eventIndex: number, eventCount: number) {
  const goldenOffset = 0.38196601125;
  return fract((eventIndex + 0.5) / eventCount + goldenOffset * (eventIndex % 3) / Math.max(3, eventCount));
}

function compactEventWWindow(localTime: number) {
  const t = clamp01(localTime);
  return smoothRange(0.43, 0.49, t) * (1 - smoothRange(0.51, 0.57, t));
}

function compactLocalBump(distance: number, radius: number) {
  if (distance >= radius) return 0;
  return smootherstep(1 - distance / radius);
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

function symmetricCurlDirection(radial: Vector3, separation: Vector3, index: number, symmetryOrder: number) {
  let curl = radial.clone().cross(separation);
  if (curl.lengthSq() < 0.000001) curl = projectedReferenceNormal(radial);
  curl.normalize();
  const azimuth = Math.atan2(radial.y, radial.x);
  const handedness = Math.sin(azimuth * symmetryOrder + index * 0.38196601125) >= 0 ? 1 : -1;
  return curl.multiplyScalar(handedness);
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

function smoothRange(edge0: number, edge1: number, x: number) {
  return smootherstep((x - edge0) / Math.max(0.0001, edge1 - edge0));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function fract(value: number) {
  return value - Math.floor(value);
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
