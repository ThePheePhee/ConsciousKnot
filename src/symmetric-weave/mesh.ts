import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import type { ExactSymmetryGroup, ExactTransitionMode, ExactWeavePattern, RibbonFrame } from '../math/types';
import { exactGroupOrder, mirrorDihedral, rotateY, rotateZ, TAU } from './groups';
import { exactWeaveSpec, type ExactWeaveMotif, type ExactWeaveSpec } from './patterns';

interface ExactSymmetricWeaveOptions {
  group: ExactSymmetryGroup;
  sourcePattern: ExactWeavePattern;
  targetPattern: ExactWeavePattern;
  transitionMode: ExactTransitionMode;
  progress: number;
  samples: number;
  crossSamples: number;
  width: number;
  shellRadius: number;
  shellThickness: number;
  liftAmplitude: number;
  showWPassage: boolean;
  relaxationSteps: number;
}

interface StripKey {
  motif: number;
  copy: number;
  mirror: 1 | -1;
}

interface ExactSample {
  direction: Vector3;
  height: number;
  wWindow: number;
}

interface ExactStrip {
  key: StripKey;
  samples: ExactSample[];
}

interface CollisionParticle {
  strip: ExactStrip;
  stripIndex: number;
  sample: ExactSample;
  sampleIndex: number;
  sampleCount: number;
  lane: number;
  position: Vector3;
  contactRadius: number;
  collisionWeight: number;
}

export function buildExactSymmetricWeaveMesh(options: ExactSymmetricWeaveOptions) {
  const order = exactGroupOrder(options.group);
  const source = exactWeaveSpec(options.sourcePattern);
  const target = exactWeaveSpec(options.targetPattern);
  const motifCount = Math.max(source.motifs.length, target.motifs.length);
  const strips = buildStripKeys(order, motifCount).map((key) => buildStrip(key, source, target, options, order, motifCount));
  const relaxSteps = Math.max(0, Math.round(options.relaxationSteps));
  relaxExactStrips(strips, options, relaxSteps);
  avoidExactSelfIntersections(strips, options, order, motifCount);
  return buildRibbonGeometry(strips, Math.max(0.2, options.shellRadius), Math.max(0.01, options.width), Math.max(4, Math.round(options.crossSamples)), options.showWPassage);
}

function buildStripKeys(order: number, motifCount: number) {
  const keys: StripKey[] = [];
  for (let motif = 0; motif < motifCount; motif++) {
    for (const mirror of [1, -1] as const) {
      for (let copy = 0; copy < order; copy++) keys.push({ motif, copy, mirror });
    }
  }
  return keys;
}

function buildStrip(
  key: StripKey,
  source: ExactWeaveSpec,
  target: ExactWeaveSpec,
  options: ExactSymmetricWeaveOptions,
  order: number,
  motifCount: number,
): ExactStrip {
  const stripCount = motifCount * order * 2;
  const samplesPerStrip = clamp(Math.round(options.samples / Math.sqrt(stripCount) * 0.72), 42, 108);
  const progress = clamp01(options.progress);
  const blend = smootherstep(progress);
  const sourceMotif = source.motifs[key.motif % source.motifs.length];
  const targetMotif = target.motifs[key.motif % target.motifs.length];
  const samples: ExactSample[] = [];

  for (let i = 0; i < samplesPerStrip; i++) {
    const u = i / samplesPerStrip;
    const sourceDirection = motifDirection(sourceMotif, key, u, order, motifCount);
    const targetDirection = motifDirection(targetMotif, key, u, order, motifCount);
    const direction = slerpUnit(sourceDirection, targetDirection, blend);
    const sourceHeight = motifHeight(source, sourceMotif, key, u, options.shellThickness, order, motifCount);
    const targetHeight = motifHeight(target, targetMotif, key, u, options.shellThickness, order, motifCount);
    samples.push({
      direction,
      height: lerp(sourceHeight, targetHeight, blend),
      wWindow: Math.abs(options.liftAmplitude) > 0.0001 ? scheduledOrbitPassage(key, u, options, order, motifCount) : 0,
    });
  }

  return { key, samples };
}

function motifDirection(motif: ExactWeaveMotif, key: StripKey, u: number, order: number, motifCount: number) {
  const theta = u * TAU;
  const wedge = TAU / order;
  const lane = familyLane(key, motifCount);
  const handed = motif.handedness * key.mirror;
  const phase = key.mirror > 0 ? motif.phase : -motif.phase;

  // The exact core is meant to live on S2 x I: each motif is a full spherical
  // band before the finite symmetry copies are applied. Keeping the base curve
  // global prevents the weave from degenerating into separated local orbit
  // clusters.
  const azimuth = theta
    + handed * motif.skew * Math.sin(motif.waves * theta + phase)
    + handed * motif.petal * Math.sin((motif.waves + 1) * theta - phase * 0.6)
    + lane * wedge * 0.08;
  const latitude = clamp(
    motif.amplitude * Math.sin(motif.waves * theta + phase)
      + motif.petal * 0.7 * Math.sin((motif.waves * 2 - 1) * theta + motif.layerPhase)
      + lane * 0.055 * Math.sin(2 * theta - phase),
    -0.86,
    0.86,
  );
  const xy = Math.sqrt(Math.max(0.0001, 1 - latitude * latitude));
  let direction = new Vector3(Math.cos(azimuth) * xy, Math.sin(azimuth) * xy, latitude);
  direction = rotateY(direction, motif.tilt + lane * 0.06);
  direction = rotateZ(direction, motif.roll + lane * wedge * 0.1);
  if (key.mirror < 0) direction = mirrorDihedral(direction);
  direction = rotateZ(direction, key.copy * wedge);
  return direction.normalize();
}

function motifHeight(spec: ExactWeaveSpec, motif: ExactWeaveMotif, key: StripKey, u: number, shellThickness: number, order: number, motifCount: number) {
  const theta = u * TAU;
  const orbitPhase = key.copy * TAU / order;
  const mirrorPhase = key.mirror > 0 ? 0 : Math.PI * 0.5;
  const layer = 0.16 * Math.sin(spec.layerFrequency * theta + motif.layerPhase + mirrorPhase + spec.orbitLayerCoupling * orbitPhase)
    + 0.08 * Math.cos((spec.layerFrequency + motif.waves) * theta - orbitPhase + motif.phase);
  const familyBias = familyLane(key, motifCount) * 0.74 + motif.layerBias * 0.24;
  return clamp((layer * spec.layerDepth + familyBias) * shellThickness, -shellThickness * 0.68, shellThickness * 0.68);
}

function scheduledOrbitPassage(
  key: StripKey,
  u: number,
  options: ExactSymmetricWeaveOptions,
  order: number,
  motifCount: number,
) {
  if (options.sourcePattern === options.targetPattern) return 0;
  const progress = clamp01(options.progress);
  if (progress <= 0 || progress >= 1) return 0;

  const exactEventCount = Math.max(1, motifCount * 2);
  const eventCount = options.transitionMode === 'local study' ? 1 : exactEventCount;
  let eventPosition = progress * eventCount;
  if (options.transitionMode === 'phase-staggered orbits') eventPosition += key.copy / Math.max(1, order) * 0.38;
  const wrappedEventPosition = eventPosition % eventCount;
  const activeEvent = Math.min(eventCount - 1, Math.floor(wrappedEventPosition));
  const localTime = wrappedEventPosition - activeEvent;

  if (options.transitionMode === 'local study') {
    if (key.motif !== 0 || key.copy !== 0 || key.mirror !== 1) return 0;
  } else {
    const activeMotif = activeEvent % motifCount;
    if (key.motif !== activeMotif) return 0;
  }

  const eventCenter = fract(0.5 / eventCount + activeEvent * 0.38196601125);
  const radius = options.transitionMode === 'local study' ? 0.07 : Math.max(0.034, 0.16 / eventCount);
  const spatial = compactLocalBump(cyclicUnitDistance(u, eventCenter), radius);
  return spatial * compactEventWWindow(localTime);
}

function avoidExactSelfIntersections(strips: ExactStrip[], options: ExactSymmetricWeaveOptions, order: number, motifCount: number, strength = 1) {
  const radius = Math.max(0.2, options.shellRadius);
  const heightLimit = Math.max(options.shellThickness * 0.74, options.width * 3.8);
  const maxContact = Math.max(options.width * 3.35, 0.14);
  const passes = Math.max(1, Math.min(3, Math.round(options.relaxationSteps * 0.35) + 1));

  for (let pass = 0; pass < passes; pass++) {
    const particles = buildRibbonCollisionParticles(strips, radius, options.width);
    const grid = buildSpatialGrid(particles.map((particle) => particle.position), maxContact);
    const heightPushes = strips.map((strip) => new Float32Array(strip.samples.length));
    const weights = strips.map((strip) => new Float32Array(strip.samples.length));
    const surfacePushes = strips.map((strip) => strip.samples.map(() => new Vector3()));

    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      const nearby = nearbySpatialIndices(grid, particle.position, maxContact);
      for (const j of nearby) {
        if (j <= i) continue;
        const other = particles[j];
        if (particle.stripIndex === other.stripIndex && cyclicIndexDistance(particle.sampleIndex, other.sampleIndex, particle.sampleCount) < 8) continue;
        const pairWeight = particle.collisionWeight * other.collisionWeight;
        if (pairWeight <= 0.0001) continue;
        const delta = particle.position.clone().sub(other.position);
        const distanceSq = delta.lengthSq();
        const contact = particle.contactRadius + other.contactRadius;
        const contactSq = contact * contact;
        if (distanceSq >= contactSq) continue;
        const distance = Math.sqrt(Math.max(0.0000001, distanceSq));
        const overlap = (contact - distance) / contact;
        const heightDelta = particle.sample.height - other.sample.height;
        const laneDelta = familyLane(particle.strip.key, motifCount) - familyLane(other.strip.key, motifCount);
        const direction = Math.abs(heightDelta) > options.width * 0.25
          ? Math.sign(heightDelta)
          : laneDelta === 0
          ? (stripRank(particle.strip.key, order) >= stripRank(other.strip.key, order) ? 1 : -1)
          : Math.sign(laneDelta);
        const amount = overlap * overlap * contact * pairWeight * (0.74 + pass * 0.1) * strength;
        heightPushes[particle.stripIndex][particle.sampleIndex] += direction * amount;
        heightPushes[other.stripIndex][other.sampleIndex] -= direction * amount;
        weights[particle.stripIndex][particle.sampleIndex] += 1;
        weights[other.stripIndex][other.sampleIndex] += 1;

        const surfaceDirection = delta.clone().sub(particle.sample.direction.clone().multiplyScalar(delta.dot(particle.sample.direction)));
        if (surfaceDirection.lengthSq() > 0.0000001) {
          const surfaceAmount = Math.min(0.038, amount / radius * 0.34);
          surfaceDirection.normalize().multiplyScalar(surfaceAmount);
          surfacePushes[particle.stripIndex][particle.sampleIndex].add(surfaceDirection);
          surfacePushes[other.stripIndex][other.sampleIndex].sub(surfaceDirection);
        }
      }
    }

    for (let stripIndex = 0; stripIndex < strips.length; stripIndex++) {
      const strip = strips[stripIndex];
      for (let sampleIndex = 0; sampleIndex < strip.samples.length; sampleIndex++) {
        const weight = weights[stripIndex][sampleIndex];
        if (weight <= 0) continue;
        const sample = strip.samples[sampleIndex];
        sample.height = clamp(sample.height + heightPushes[stripIndex][sampleIndex] / weight, -heightLimit, heightLimit);
        const surfacePush = surfacePushes[stripIndex][sampleIndex];
        if (surfacePush.lengthSq() > 0.0000001) {
          sample.direction.add(surfacePush.multiplyScalar(1 / Math.max(1, weight))).normalize();
        }
      }
    }
  }
}

function buildRibbonCollisionParticles(strips: ExactStrip[], radius: number, width: number) {
  const particles: CollisionParticle[] = [];
  const lanes = [-0.96, 0, 0.96];

  for (let stripIndex = 0; stripIndex < strips.length; stripIndex++) {
    const strip = strips[stripIndex];
    const centers = strip.samples.map((sample) => sample.direction.clone().multiplyScalar(radius + sample.height));
    for (let sampleIndex = 0; sampleIndex < strip.samples.length; sampleIndex++) {
      const sample = strip.samples[sampleIndex];
      const collisionWeight = sampleCollisionWeight(sample);
      if (collisionWeight <= 0.0001) continue;
      const center = centers[sampleIndex];
      const prev = centers[(sampleIndex - 1 + centers.length) % centers.length];
      const next = centers[(sampleIndex + 1) % centers.length];
      const tangent = next.clone().sub(prev).normalize();
      const outward = sample.direction.clone().normalize();
      let normal = outward.clone().cross(tangent).normalize();
      if (normal.lengthSq() < 0.000001) normal = projectedReferenceNormal(tangent);

      for (const lane of lanes) {
        const edge = Math.pow(Math.abs(lane), 2.8);
        const position = center
          .clone()
          .addScaledVector(normal, width * lane)
          .addScaledVector(outward, edge * width * 0.08);
        particles.push({
          strip,
          stripIndex,
          sample,
          sampleIndex,
          sampleCount: strip.samples.length,
          lane,
          position,
          contactRadius: collisionContactRadius(lane, width),
          collisionWeight: collisionWeight * (lane === 0 ? 1 : 0.78),
        });
      }
    }
  }

  return particles;
}

function collisionContactRadius(lane: number, width: number) {
  if (lane === 0) return width * 1.14 + 0.018;
  return width * 0.68 + 0.016;
}

function relaxExactStrips(strips: ExactStrip[], options: ExactSymmetricWeaveOptions, steps: number, strength = 1) {
  const heightLimit = Math.max(options.shellThickness * 0.7, options.width * 3.4);
  for (let step = 0; step < steps; step++) {
    for (const strip of strips) {
      const n = strip.samples.length;
      const nextDirections: Vector3[] = [];
      const nextHeights = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const sample = strip.samples[i];
        const prev = strip.samples[(i - 1 + n) % n];
        const next = strip.samples[(i + 1) % n];
        const average = prev.direction.clone().add(next.direction).normalize();
        const curvature = 1 - clamp(sample.direction.dot(average), -1, 1);
        const heightGradient = (Math.abs(sample.height - prev.height) + Math.abs(next.height - sample.height))
          / Math.max(options.shellThickness, 0.001);
        const crossingGate = 1 - 0.5 * smootherstep(heightGradient * 1.8);
        const localAmount = (0.042 + 0.04 * smootherstep(curvature * 28))
          * (1 - smootherstep(sample.wWindow * 1.35))
          * crossingGate
          * strength;
        nextDirections.push(slerpUnit(sample.direction, average, localAmount));
        nextHeights[i] = clamp(lerp(sample.height, (prev.height + next.height) * 0.5, localAmount * 0.82), -heightLimit, heightLimit);
      }
      for (let i = 0; i < n; i++) {
        strip.samples[i].direction.copy(nextDirections[i]).normalize();
        strip.samples[i].height = nextHeights[i];
      }
      clampStripToShellDepth(strip, heightLimit);
    }
  }
}

function clampStripToShellDepth(strip: ExactStrip, heightLimit: number) {
  for (const sample of strip.samples) {
    sample.direction.normalize();
    sample.height = clamp(sample.height, -heightLimit, heightLimit);
  }
}

function familyLane(key: StripKey, motifCount: number) {
  const laneCount = Math.max(2, motifCount * 2);
  const laneIndex = key.motif * 2 + (key.mirror < 0 ? 1 : 0);
  return laneCount <= 1 ? 0 : laneIndex / (laneCount - 1) * 2 - 1;
}

function stripRank(key: StripKey, order: number) {
  return (key.motif * 2 + (key.mirror < 0 ? 1 : 0)) * order + key.copy;
}

function buildRibbonGeometry(strips: ExactStrip[], radius: number, width: number, crossSamples: number, showWPassage: boolean) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const wIntensities: number[] = [];
  const wAlphas: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const strip of strips) {
    const frames = buildFrames(strip, radius);
    const n = frames.length;
    const wDepths = strip.samples.map((sample) => clamp01(sample.wWindow));
    const widthScale = wDepths.map((wDepth) => showWPassage || wDepth <= 0.001 ? 1 : 0);
    const wIntensity = wDepths.map((wDepth) => showWPassage && wDepth > 0.001 ? 1 : 0);
    const wAlpha = wDepths.map((wDepth) => showWPassage && wDepth > 0.001 ? 0.12 + 0.34 * (1 - smootherstep(wDepth)) : 1);

    for (let i = 0; i < n; i++) {
      const frame = frames[i];
      for (let j = 0; j < crossSamples; j++) {
        const v = j / (crossSamples - 1);
        const across = v * 2 - 1;
        const edge = Math.pow(Math.abs(across), 2.8);
        const localWidth = width * (widthScale[i] ?? 1);
        const position = frame.position
          .clone()
          .addScaledVector(frame.normal, localWidth * across)
          .addScaledVector(frame.outward, edge * localWidth * 0.08);
        const normal = frame.outward
          .clone()
          .multiplyScalar(0.92 + edge * 0.4)
          .addScaledVector(frame.binormal, 0.16)
          .addScaledVector(frame.normal, across * 0.08)
          .normalize();
        positions.push(position.x, position.y, position.z);
        normals.push(normal.x, normal.y, normal.z);
        uvs.push((i / n + strip.key.motif * 0.137 + strip.key.copy * 0.019) % 1, v);
        wIntensities.push(wIntensity[i] ?? 0);
        wAlphas.push(wAlpha[i] ?? 1);
      }
    }

    for (let i = 0; i < n; i++) {
      const ni = (i + 1) % n;
      const visibleA = (widthScale[i] ?? 1) > 0.04;
      const visibleB = (widthScale[ni] ?? 1) > 0.04;
      if (!visibleA || !visibleB) continue;
      for (let j = 0; j < crossSamples - 1; j++) {
        const a = vertexOffset + i * crossSamples + j;
        const b = vertexOffset + ni * crossSamples + j;
        const c = vertexOffset + ni * crossSamples + j + 1;
        const d = vertexOffset + i * crossSamples + j + 1;
        indices.push(a, b, d, b, c, d);
      }
    }

    vertexOffset += n * crossSamples;
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

function buildFrames(strip: ExactStrip, radius: number) {
  const n = strip.samples.length;
  const positions = strip.samples.map((sample) => sample.direction.clone().multiplyScalar(radius + sample.height));
  const frames: RibbonFrame[] = [];

  for (let i = 0; i < n; i++) {
    const tangent = positions[(i + 1) % n].clone().sub(positions[(i - 1 + n) % n]).normalize();
    const outward = strip.samples[i].direction.clone().normalize();
    let normal = outward.clone().cross(tangent).normalize();
    if (normal.lengthSq() < 0.000001) normal = projectedReferenceNormal(tangent);
    const binormal = tangent.clone().cross(normal).normalize();
    frames.push({
      position: positions[i],
      tangent,
      normal,
      binormal,
      outward,
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

function slerpUnit(a: Vector3, b: Vector3, t: number) {
  const amount = clamp01(t);
  const dot = clamp(a.dot(b), -0.9995, 0.9995);
  const theta = Math.acos(dot) * amount;
  const relative = b.clone().sub(a.clone().multiplyScalar(dot));
  if (relative.lengthSq() < 0.000001) return a.clone().lerp(b, amount).normalize();
  relative.normalize();
  return a.clone().multiplyScalar(Math.cos(theta)).add(relative.multiplyScalar(Math.sin(theta))).normalize();
}

function compactEventWWindow(localTime: number) {
  const t = clamp01(localTime);
  return smoothRange(0.43, 0.49, t) * (1 - smoothRange(0.51, 0.57, t));
}

function compactLocalBump(distance: number, radius: number) {
  if (distance >= radius) return 0;
  return smootherstep(1 - distance / radius);
}

function sampleCollisionWeight(sample: ExactSample) {
  return 1 - smootherstep(clamp01(sample.wWindow * 1.35));
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
