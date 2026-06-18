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
  twistTurns: number;
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
  const targetPhase = alignedPhase(sourceKnot, targetKnot, options.samples);
  const stage = stagedProgress(segmentT, segmentIndex, options);
  const points: Vector3[] = [];
  const visibility: number[] = [];
  for (let i = 0; i < options.samples; i++) {
    const t = (i / options.samples) * Math.PI * 2;
    const source = devKnotPoint(sourceKnot, t);
    const target = devKnotPoint(targetKnot, t + targetPhase);
    const xyz = source.clone().lerp(target, smootherstep(stage.morph));
    const local = localizedLift(t, segmentIndex, options.simultaneousUncrossings);
    const lift = options.crossingMode === 'projected intersections' ? 0 : options.liftAmplitude * stage.crossingWindow * local.signedLift;
    const hidden = options.crossingMode === 'hidden 4D passage' ? options.hideDuringUncrossing * stage.crossingWindow * local.window : 0;
    visibility.push(Math.max(0.025, 1 - hidden));
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

function smootherstep(x: number) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function stagedProgress(segmentT: number, segmentIndex: number, options: DeveloperRibbonOptions) {
  const relax = Math.min(0.85, Math.max(0, segmentIndex === 0 ? options.canonicalRelaxation : options.intermediateRelaxation));
  if (segmentT < relax) {
    return { morph: 0, crossingWindow: 0 };
  }
  const crossingT = smootherstep((segmentT - relax) / Math.max(0.0001, 1 - relax));
  return {
    morph: crossingT,
    crossingWindow: Math.pow(Math.sin(Math.PI * crossingT), 1.4),
  };
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
    for (let j = 0; j < m - 1; j++) {
      const hiddenQuad = (visibility[i] ?? 1) < 0.06 && (visibility[ni] ?? 1) < 0.06;
      if (hiddenQuad) continue;
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
