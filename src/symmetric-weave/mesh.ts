import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import type { ExactSymmetryGroup, ExactTransitionMode, ExactWeavePattern, RibbonFrame } from '../math/types';
import { exactGroupOrder, mirrorDihedral, rotateY, rotateZ, TAU } from './groups';
import { exactWeaveSpec, type ExactWeaveMotif, type ExactWeaveSpec } from './patterns';

interface ExactSymmetricWeaveOptions {
  group: ExactSymmetryGroup;
  sourcePattern: ExactWeavePattern;
  targetPattern: ExactWeavePattern;
  trajectoryPatterns?: ExactWeavePattern[];
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
  symmetrySettle: number;
  solidSolve: boolean;
  solidPasses: number;
  creaseStrength: number;
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

interface ActiveExactTransition {
  source: ExactWeaveSpec;
  target: ExactWeaveSpec;
  progress: number;
  segmentIndex: number;
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

interface SegmentParticle {
  strip: ExactStrip;
  stripIndex: number;
  sampleIndex: number;
  nextIndex: number;
  sampleCount: number;
  midpoint: Vector3;
  start: Vector3;
  end: Vector3;
  collisionWeight: number;
}

interface ExactPushBuffers {
  tangentPushes: Vector3[][];
  heightPushes: Float32Array[];
  weights: Float32Array[];
}

export function buildExactSymmetricWeaveMesh(options: ExactSymmetricWeaveOptions) {
  const order = exactGroupOrder(options.group);
  const trajectory = exactTrajectory(options);
  const active = activeExactTransition(trajectory, options.progress);
  const motifCount = Math.max(active.source.motifs.length, active.target.motifs.length);
  const strips = buildStripKeys(order, motifCount).map((key) => buildStrip(key, active, options, order, motifCount));
  const relaxSteps = Math.max(0, Math.round(options.relaxationSteps));
  relaxExactStrips(strips, options, relaxSteps);
  avoidExactSelfIntersections(strips, options, order, motifCount);
  resolveExactSolidFibres(strips, options, order, motifCount);
  projectRotationalSymmetry(strips, order, options.symmetrySettle);
  relaxExactStrips(strips, options, Math.ceil(relaxSteps * 0.35), 0.58);
  resolveExactSolidFibres(strips, options, order, motifCount, 0.65);
  projectRotationalSymmetry(strips, order, options.symmetrySettle * 0.55);
  resolveExactSolidFibres(strips, options, order, motifCount, 0.42, 2);
  return buildRibbonGeometry(strips, Math.max(0.2, options.shellRadius), Math.max(0.01, options.width), Math.max(4, Math.round(options.crossSamples)), options.showWPassage);
}

function exactTrajectory(options: ExactSymmetricWeaveOptions) {
  const rawPatterns = options.trajectoryPatterns?.length
    ? options.trajectoryPatterns
    : [options.sourcePattern, options.targetPattern];
  const patterns = rawPatterns.slice(0, 4);
  while (patterns.length < 2) patterns.push(options.targetPattern);
  return patterns.map((pattern) => exactWeaveSpec(pattern));
}

function activeExactTransition(trajectory: ExactWeaveSpec[], progress: number): ActiveExactTransition {
  const segmentCount = Math.max(1, trajectory.length - 1);
  const scaled = clamp01(progress) * segmentCount;
  const segmentIndex = Math.min(segmentCount - 1, Math.floor(scaled));
  const localProgress = scaled - segmentIndex;
  return {
    source: trajectory[segmentIndex],
    target: trajectory[segmentIndex + 1],
    progress: localProgress,
    segmentIndex,
  };
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
  active: ActiveExactTransition,
  options: ExactSymmetricWeaveOptions,
  order: number,
  motifCount: number,
): ExactStrip {
  const stripCount = motifCount * order * 2;
  const samplesPerStrip = clamp(Math.round(options.samples / Math.sqrt(stripCount) * 0.72), 42, 108);
  const blend = continuousMotionBlend(active.progress);
  const sourceMotif = active.source.motifs[key.motif % active.source.motifs.length];
  const targetMotif = active.target.motifs[key.motif % active.target.motifs.length];
  const samples: ExactSample[] = [];

  for (let i = 0; i < samplesPerStrip; i++) {
    const u = i / samplesPerStrip;
    const sourceDirection = motifDirection(sourceMotif, key, u, order, motifCount);
    const targetDirection = motifDirection(targetMotif, key, u, order, motifCount);
    const direction = slerpUnit(sourceDirection, targetDirection, blend);
    const sourceHeight = motifHeight(active.source, sourceMotif, key, u, options.shellThickness, order, motifCount);
    const targetHeight = motifHeight(active.target, targetMotif, key, u, options.shellThickness, order, motifCount);
    samples.push({
      direction,
      height: lerp(sourceHeight, targetHeight, blend),
      wWindow: Math.abs(options.liftAmplitude) > 0.0001 ? scheduledOrbitPassage(key, u, active, options, order, motifCount) : 0,
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
  active: ActiveExactTransition,
  options: ExactSymmetricWeaveOptions,
  order: number,
  motifCount: number,
) {
  if (active.source.pattern === active.target.pattern) return 0;
  const progress = clamp01(active.progress);
  if (progress <= 0 || progress >= 1) return 0;

  const exactEventCount = Math.max(1, motifCount * 2);
  const eventCount = options.transitionMode === 'local study' ? 1 : exactEventCount;
  let eventPosition = progress * eventCount;
  eventPosition += active.segmentIndex * 0.2360679775;
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

function projectRotationalSymmetry(strips: ExactStrip[], order: number, strength: number) {
  const amount = clamp01(strength);
  if (amount <= 0.0001 || strips.length === 0) return;
  const wedge = TAU / order;
  const byOrbit = new Map<string, ExactStrip[]>();

  for (const strip of strips) {
    const key = `${strip.key.motif}:${strip.key.mirror}`;
    const orbit = byOrbit.get(key);
    if (orbit) orbit.push(strip);
    else byOrbit.set(key, [strip]);
  }

  for (const orbit of byOrbit.values()) {
    const sampleCount = orbit[0]?.samples.length ?? 0;
    if (sampleCount === 0) continue;

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
      const canonical = new Vector3();
      let totalWeight = 0;
      for (const strip of orbit) {
        const sample = strip.samples[sampleIndex];
        const wGate = 1 - smootherstep(sample.wWindow * 1.5);
        const weight = 0.35 + 0.65 * wGate;
        canonical.add(rotateZ(sample.direction, -strip.key.copy * wedge).multiplyScalar(weight));
        totalWeight += weight;
      }
      if (canonical.lengthSq() < 0.000001 || totalWeight <= 0) continue;
      canonical.multiplyScalar(1 / totalWeight).normalize();

      for (const strip of orbit) {
        const sample = strip.samples[sampleIndex];
        const wGate = 1 - smootherstep(sample.wWindow * 1.5);
        const target = rotateZ(canonical, strip.key.copy * wedge);
        sample.direction.copy(slerpUnit(sample.direction, target, amount * (0.45 + 0.55 * wGate))).normalize();
      }
    }
  }
}

function resolveExactSolidFibres(
  strips: ExactStrip[],
  options: ExactSymmetricWeaveOptions,
  order: number,
  motifCount: number,
  strengthScale = 1,
  passOverride?: number,
) {
  if (!options.solidSolve) return;
  const passes = passOverride ?? Math.max(0, Math.round(options.solidPasses));
  if (passes <= 0) return;

  const radius = Math.max(0.2, options.shellRadius);
  const width = Math.max(0.01, options.width);
  const widthStress = clamp((width - 0.065) / 0.09, 0, 1);
  const heightLimit = Math.max(options.shellThickness * 0.86, width * 5.2);
  const strength = clamp01(strengthScale);
  const creaseStrength = clamp01(options.creaseStrength);
  const pointContact = Math.max(width * (2.55 + widthStress * 0.72), 0.13 + widthStress * 0.03);
  const segmentContact = Math.max(width * (2.85 + widthStress * 0.9), pointContact * 1.06);
  const surfaceContact = Math.max(width * (0.96 + widthStress * 0.42), 0.05 + widthStress * 0.02);

  for (let pass = 0; pass < passes; pass++) {
    const buffers = createExactPushBuffers(strips);
    accumulateSolidPointContacts(strips, buffers, radius, width, pointContact, strength * (0.72 + pass * 0.045), creaseStrength, motifCount);
    accumulateSolidSegmentContacts(strips, buffers, radius, segmentContact, strength * (0.56 + pass * 0.04), creaseStrength, order, motifCount);
    accumulateSolidSurfaceContacts(strips, buffers, radius, width, surfaceContact, strength * (0.88 + pass * 0.055), creaseStrength, motifCount, widthStress);
    applyExactPushBuffers(strips, buffers, radius, heightLimit, width * (0.62 + widthStress * 0.14));

    if (pass % 2 === 1 || pass === passes - 1) {
      relaxExactStrips(strips, options, 1, 0.18 + 0.1 * (1 - widthStress));
    }
  }
}

function createExactPushBuffers(strips: ExactStrip[]): ExactPushBuffers {
  return {
    tangentPushes: strips.map((strip) => strip.samples.map(() => new Vector3())),
    heightPushes: strips.map((strip) => new Float32Array(strip.samples.length)),
    weights: strips.map((strip) => new Float32Array(strip.samples.length)),
  };
}

function accumulateSolidPointContacts(
  strips: ExactStrip[],
  buffers: ExactPushBuffers,
  radius: number,
  width: number,
  contact: number,
  strength: number,
  creaseStrength: number,
  motifCount: number,
) {
  const particles = buildCenterCollisionParticles(strips, radius, width, motifCount);
  const grid = buildSpatialGrid(particles.map((particle) => particle.position), contact);
  const contactSq = contact * contact;

  for (let i = 0; i < particles.length; i++) {
    const particle = particles[i];
    const nearby = nearbySpatialIndices(grid, particle.position, contact);
    for (const j of nearby) {
      if (j <= i) continue;
      const other = particles[j];
      if (particle.stripIndex === other.stripIndex && cyclicIndexDistance(particle.sampleIndex, other.sampleIndex, particle.sampleCount) < 9) continue;
      const pairWeight = particle.collisionWeight * other.collisionWeight;
      if (pairWeight <= 0.0001) continue;

      const delta = particle.position.clone().sub(other.position);
      const distanceSq = delta.lengthSq();
      if (distanceSq >= contactSq) continue;
      const distance = Math.sqrt(Math.max(0.0000001, distanceSq));
      const overlap = (contact - distance) / contact;
      const amount = overlap * overlap * contact * strength * pairWeight;
      const direction = stableDirection(delta, particle.stripIndex * 4096 + particle.sampleIndex, other.stripIndex * 4096 + other.sampleIndex);
      addExactWorldPush(strips, buffers, particle.stripIndex, particle.sampleIndex, direction, amount, creaseStrength);
      addExactWorldPush(strips, buffers, other.stripIndex, other.sampleIndex, direction.clone().multiplyScalar(-1), amount, creaseStrength);
    }
  }
}

function accumulateSolidSegmentContacts(
  strips: ExactStrip[],
  buffers: ExactPushBuffers,
  radius: number,
  contact: number,
  strength: number,
  creaseStrength: number,
  order: number,
  motifCount: number,
) {
  const segments = buildSegmentParticles(strips, radius);
  const grid = buildSpatialGrid(segments.map((segment) => segment.midpoint), contact);
  const contactSq = contact * contact;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const nearby = nearbySpatialIndices(grid, segment.midpoint, contact);
    for (const j of nearby) {
      if (j <= i) continue;
      const other = segments[j];
      if (segment.stripIndex === other.stripIndex && cyclicIndexDistance(segment.sampleIndex, other.sampleIndex, segment.sampleCount) < 8) continue;
      if (segment.strip.key.motif === other.strip.key.motif
        && segment.strip.key.mirror === other.strip.key.mirror
        && cyclicIndexDistance(segment.sampleIndex, other.sampleIndex, segment.sampleCount) < 5) continue;
      const pairWeight = segment.collisionWeight * other.collisionWeight;
      if (pairWeight <= 0.0001) continue;

      const closest = closestSegmentParameters(segment.start, segment.end, other.start, other.end);
      if (closest.distanceSq >= contactSq) continue;
      const distance = Math.sqrt(Math.max(0.0000001, closest.distanceSq));
      const overlap = (contact - distance) / contact;
      const orderBias = contactOrderingBias(segment.strip.key, other.strip.key, order, motifCount);
      const direction = stableDirection(closest.delta, segment.stripIndex * 4096 + segment.sampleIndex, other.stripIndex * 4096 + other.sampleIndex);
      const response = direction.addScaledVector(segment.strip.samples[segment.sampleIndex].direction, orderBias * 0.18).normalize();
      const amount = overlap * overlap * contact * strength * pairWeight;
      addExactWorldPush(strips, buffers, segment.stripIndex, segment.sampleIndex, response, amount * (1 - closest.s), creaseStrength);
      addExactWorldPush(strips, buffers, segment.stripIndex, segment.nextIndex, response, amount * closest.s, creaseStrength);
      addExactWorldPush(strips, buffers, other.stripIndex, other.sampleIndex, response.clone().multiplyScalar(-1), amount * (1 - closest.t), creaseStrength);
      addExactWorldPush(strips, buffers, other.stripIndex, other.nextIndex, response.clone().multiplyScalar(-1), amount * closest.t, creaseStrength);
    }
  }
}

function accumulateSolidSurfaceContacts(
  strips: ExactStrip[],
  buffers: ExactPushBuffers,
  radius: number,
  width: number,
  contact: number,
  strength: number,
  creaseStrength: number,
  motifCount: number,
  widthStress: number,
) {
  const probes = buildSolidSurfaceParticles(strips, radius, width, motifCount, widthStress);
  const cellSize = Math.max(contact * 2.05, width * (1.1 + widthStress * 0.45));
  const grid = buildSpatialGrid(probes.map((probe) => probe.position), cellSize);
  const contactSq = contact * contact;

  for (let i = 0; i < probes.length; i++) {
    const probe = probes[i];
    const nearby = nearbySpatialIndices(grid, probe.position, cellSize);
    for (const j of nearby) {
      if (j <= i) continue;
      const other = probes[j];
      if (probe.stripIndex === other.stripIndex && cyclicIndexDistance(probe.sampleIndex, other.sampleIndex, probe.sampleCount) < 9) continue;
      const pairWeight = probe.collisionWeight * other.collisionWeight;
      if (pairWeight <= 0.0001) continue;

      const delta = probe.position.clone().sub(other.position);
      const distanceSq = delta.lengthSq();
      if (distanceSq >= contactSq) continue;
      const distance = Math.sqrt(Math.max(0.0000001, distanceSq));
      const overlap = (contact - distance) / contact;
      const separation = stableDirection(delta, probe.stripIndex * 4096 + probe.sampleIndex, other.stripIndex * 4096 + other.sampleIndex);
      const curl = symmetricCurlDirection(probe.sample.direction, separation, probe.sampleIndex, Math.max(2, motifCount * 2));
      const response = separation
        .clone()
        .multiplyScalar(0.68 - widthStress * 0.08)
        .addScaledVector(curl, (0.32 + widthStress * 0.18) * overlap)
        .normalize();
      const amount = overlap * overlap * contact * strength * pairWeight * (1 + widthStress * 0.5);
      addExactWorldPush(strips, buffers, probe.stripIndex, probe.sampleIndex, response, amount, creaseStrength);
      addExactWorldPush(strips, buffers, other.stripIndex, other.sampleIndex, response.clone().multiplyScalar(-1), amount, creaseStrength);
    }
  }
}

function applyExactPushBuffers(strips: ExactStrip[], buffers: ExactPushBuffers, radius: number, heightLimit: number, maxMove: number) {
  for (let stripIndex = 0; stripIndex < strips.length; stripIndex++) {
    const strip = strips[stripIndex];
    for (let sampleIndex = 0; sampleIndex < strip.samples.length; sampleIndex++) {
      const weight = buffers.weights[stripIndex][sampleIndex];
      if (weight <= 0) continue;
      const sample = strip.samples[sampleIndex];
      const tangentMove = buffers.tangentPushes[stripIndex][sampleIndex].multiplyScalar(1 / weight);
      const tangentLength = tangentMove.length();
      if (tangentLength > maxMove) tangentMove.multiplyScalar(maxMove / tangentLength);
      sample.direction.add(tangentMove.multiplyScalar(1 / Math.max(0.4, radius + sample.height))).normalize();
      const heightMove = clamp(buffers.heightPushes[stripIndex][sampleIndex] / weight, -maxMove, maxMove);
      sample.height = clamp(sample.height + heightMove, -heightLimit, heightLimit);
    }
  }
}

function addExactWorldPush(
  strips: ExactStrip[],
  buffers: ExactPushBuffers,
  stripIndex: number,
  sampleIndex: number,
  direction: Vector3,
  amount: number,
  creaseStrength: number,
) {
  if (amount <= 0) return;
  const n = strips[stripIndex].samples.length;
  distributeExactWorldPush(strips, buffers, stripIndex, sampleIndex, direction, amount, 1);
  const crease = clamp01(creaseStrength);
  if (crease <= 0.0001) return;
  distributeExactWorldPush(strips, buffers, stripIndex, (sampleIndex - 1 + n) % n, direction, amount * crease * 0.46, 0.7);
  distributeExactWorldPush(strips, buffers, stripIndex, (sampleIndex + 1) % n, direction, amount * crease * 0.46, 0.7);
  distributeExactWorldPush(strips, buffers, stripIndex, (sampleIndex - 2 + n) % n, direction, amount * crease * 0.2, 0.45);
  distributeExactWorldPush(strips, buffers, stripIndex, (sampleIndex + 2) % n, direction, amount * crease * 0.2, 0.45);
}

function distributeExactWorldPush(
  strips: ExactStrip[],
  buffers: ExactPushBuffers,
  stripIndex: number,
  sampleIndex: number,
  direction: Vector3,
  amount: number,
  weight: number,
) {
  const sample = strips[stripIndex].samples[sampleIndex];
  const radial = sample.direction;
  const radialPart = direction.dot(radial);
  const tangentPart = direction.clone().sub(radial.clone().multiplyScalar(radialPart));
  buffers.tangentPushes[stripIndex][sampleIndex].addScaledVector(tangentPart, amount);
  buffers.heightPushes[stripIndex][sampleIndex] += radialPart * amount;
  buffers.weights[stripIndex][sampleIndex] += weight;
}

function buildCenterCollisionParticles(strips: ExactStrip[], radius: number, width: number, motifCount: number): CollisionParticle[] {
  const particles: CollisionParticle[] = [];
  for (let stripIndex = 0; stripIndex < strips.length; stripIndex++) {
    const strip = strips[stripIndex];
    for (let sampleIndex = 0; sampleIndex < strip.samples.length; sampleIndex++) {
      const sample = strip.samples[sampleIndex];
      const collisionWeight = sampleCollisionWeight(sample);
      if (collisionWeight <= 0.0001) continue;
      particles.push({
        strip,
        stripIndex,
        sample,
        sampleIndex,
        sampleCount: strip.samples.length,
        lane: familyLane(strip.key, motifCount),
        position: sample.direction.clone().multiplyScalar(radius + sample.height),
        contactRadius: width * 0.92 + 0.018,
        collisionWeight,
      });
    }
  }
  return particles;
}

function buildSegmentParticles(strips: ExactStrip[], radius: number): SegmentParticle[] {
  const segments: SegmentParticle[] = [];
  for (let stripIndex = 0; stripIndex < strips.length; stripIndex++) {
    const strip = strips[stripIndex];
    const positions = strip.samples.map((sample) => sample.direction.clone().multiplyScalar(radius + sample.height));
    for (let sampleIndex = 0; sampleIndex < strip.samples.length; sampleIndex++) {
      const nextIndex = (sampleIndex + 1) % strip.samples.length;
      const collisionWeight = segmentCollisionWeight(strip.samples, sampleIndex, nextIndex);
      if (collisionWeight <= 0.0001) continue;
      segments.push({
        strip,
        stripIndex,
        sampleIndex,
        nextIndex,
        sampleCount: strip.samples.length,
        start: positions[sampleIndex],
        end: positions[nextIndex],
        midpoint: positions[sampleIndex].clone().add(positions[nextIndex]).multiplyScalar(0.5),
        collisionWeight,
      });
    }
  }
  return segments;
}

function buildSolidSurfaceParticles(strips: ExactStrip[], radius: number, width: number, motifCount: number, widthStress: number) {
  const particles: CollisionParticle[] = [];
  const lanes = solidSurfaceLanes(widthStress);
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
        particles.push({
          strip,
          stripIndex,
          sample,
          sampleIndex,
          sampleCount: strip.samples.length,
          lane,
          position: center
            .clone()
            .addScaledVector(normal, width * lane)
            .addScaledVector(outward, edge * width * 0.08),
          contactRadius: solidSurfaceContactRadius(lane, width),
          collisionWeight: collisionWeight * (0.55 + edge * 0.45 + (lane === 0 ? 0.18 : 0)),
        });
      }
    }
  }
  return particles;
}

function solidSurfaceLanes(widthStress: number) {
  if (widthStress > 0.72) return [-0.98, -0.74, -0.5, -0.26, 0, 0.26, 0.5, 0.74, 0.98];
  if (widthStress > 0.28) return [-0.98, -0.62, -0.28, 0, 0.28, 0.62, 0.98];
  return [-0.96, -0.48, 0, 0.48, 0.96];
}

function solidSurfaceContactRadius(lane: number, width: number) {
  const edge = Math.pow(Math.abs(lane), 1.8);
  return width * (0.34 + edge * 0.18) + 0.012;
}

function segmentCollisionWeight(samples: ExactSample[], a: number, b: number) {
  return Math.min(sampleCollisionWeight(samples[a]), sampleCollisionWeight(samples[b]));
}

function contactOrderingBias(a: StripKey, b: StripKey, order: number, motifCount: number) {
  const lane = familyLane(a, motifCount) - familyLane(b, motifCount);
  if (Math.abs(lane) > 0.001) return Math.sign(lane);
  return stripRank(a, order) >= stripRank(b, order) ? 1 : -1;
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

function continuousMotionBlend(x: number) {
  const t = clamp01(x);
  return clamp01(t + 0.035 * Math.sin(TAU * t));
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
