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

export function buildExactSymmetricWeaveMesh(options: ExactSymmetricWeaveOptions) {
  const order = exactGroupOrder(options.group);
  const source = exactWeaveSpec(options.sourcePattern);
  const target = exactWeaveSpec(options.targetPattern);
  const motifCount = Math.max(source.motifs.length, target.motifs.length);
  const strips = buildStripKeys(order, motifCount).map((key) => buildStrip(key, source, target, options, order, motifCount));
  relaxExactStrips(strips, options, Math.max(0, Math.round(options.relaxationSteps)));
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
  const samplesPerStrip = clamp(Math.round(options.samples / Math.sqrt(stripCount)), 56, 156);
  const progress = clamp01(options.progress);
  const blend = smootherstep(progress);
  const sourceMotif = source.motifs[key.motif % source.motifs.length];
  const targetMotif = target.motifs[key.motif % target.motifs.length];
  const samples: ExactSample[] = [];

  for (let i = 0; i < samplesPerStrip; i++) {
    const u = i / samplesPerStrip;
    const sourceDirection = motifDirection(sourceMotif, key, u, order);
    const targetDirection = motifDirection(targetMotif, key, u, order);
    const direction = slerpUnit(sourceDirection, targetDirection, blend);
    const sourceHeight = motifHeight(source, sourceMotif, key, u, options.shellThickness, order);
    const targetHeight = motifHeight(target, targetMotif, key, u, options.shellThickness, order);
    samples.push({
      direction,
      height: lerp(sourceHeight, targetHeight, blend),
      wWindow: Math.abs(options.liftAmplitude) > 0.0001 ? scheduledOrbitPassage(key, u, options, order, motifCount) : 0,
    });
  }

  return { key, samples };
}

function motifDirection(motif: ExactWeaveMotif, key: StripKey, u: number, order: number) {
  const theta = u * TAU;
  const handed = motif.handedness * key.mirror;
  const phase = key.mirror > 0 ? motif.phase : -motif.phase;
  const azimuth = theta
    + handed * motif.skew * Math.sin(motif.waves * theta + phase)
    + handed * motif.petal * Math.sin((motif.waves + 1) * theta - phase * 0.6);
  const z = clamp(
    motif.amplitude * Math.sin(motif.waves * theta + phase)
      + motif.petal * Math.sin(motif.waves * 2 * theta + phase * 0.5),
    -0.86,
    0.86,
  );
  const xy = Math.sqrt(Math.max(0.0001, 1 - z * z));
  let direction = new Vector3(Math.cos(azimuth) * xy, Math.sin(azimuth) * xy, z);
  direction = rotateY(direction, motif.tilt);
  direction = rotateZ(direction, motif.roll);
  if (key.mirror < 0) direction = mirrorDihedral(direction);
  direction = rotateZ(direction, key.copy * TAU / order);
  return direction.normalize();
}

function motifHeight(spec: ExactWeaveSpec, motif: ExactWeaveMotif, key: StripKey, u: number, shellThickness: number, order: number) {
  const theta = u * TAU;
  const orbitPhase = key.copy * TAU / order;
  const mirrorPhase = key.mirror > 0 ? 0 : Math.PI * 0.5;
  const layer = 0.36 * Math.sin(spec.layerFrequency * theta + motif.layerPhase + mirrorPhase + spec.orbitLayerCoupling * orbitPhase)
    + 0.16 * Math.cos((spec.layerFrequency + motif.waves) * theta - orbitPhase + motif.phase);
  const familyBias = motif.layerBias + key.mirror * 0.035;
  return clamp((layer * spec.layerDepth + familyBias) * shellThickness, -shellThickness * 0.47, shellThickness * 0.47);
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

function relaxExactStrips(strips: ExactStrip[], options: ExactSymmetricWeaveOptions, steps: number) {
  const heightLimit = Math.max(options.shellThickness * 0.47, options.width * 1.75);
  for (let step = 0; step < steps; step++) {
    for (const strip of strips) {
      const n = strip.samples.length;
      const nextDirections: Vector3[] = [];
      const nextHeights = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const sample = strip.samples[i];
        const prev = strip.samples[(i - 1 + n) % n];
        const next = strip.samples[(i + 1) % n];
        const localAmount = 0.035 * (1 - smootherstep(sample.wWindow));
        const average = prev.direction.clone().add(next.direction).normalize();
        nextDirections.push(slerpUnit(sample.direction, average, localAmount));
        nextHeights[i] = clamp(lerp(sample.height, (prev.height + next.height) * 0.5, localAmount * 1.2), -heightLimit, heightLimit);
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
